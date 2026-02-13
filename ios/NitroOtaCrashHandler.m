//
//  NitroOtaCrashHandler.m
//  NitroOta
//

#import "NitroOtaCrashHandler.h"
#import <Foundation/Foundation.h>
#import <signal.h>

// MARK: - Constants

static NSString *const kNitroOtaSuiteName = @"NitroOtaPrefs";

// MARK: - Globals (readable from C signal handlers)

/// true only when the current OTA bundle is pending confirmation.
/// Set on every app launch based on stored preferences.
static BOOL gNitroOtaIsPendingValidation = NO;

/// The app version string (dots replaced with underscores) used as a key suffix.
static NSString *gNitroOtaAppVersion = nil;

/// Previous NSException handler to forward crashes to after our processing.
static NSUncaughtExceptionHandler *gNitroOtaPreviousExceptionHandler = NULL;

// MARK: - Helpers

static NSString *NitroOtaGetAppVersion(void) {
    NSString *version = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleShortVersionString"];
    if (!version) version = @"unknown";
    return [version stringByReplacingOccurrencesOfString:@"." withString:@"_"];
}

/// Builds a versioned preference key like "ota_unzipped_path_1_0_0"
static NSString *NitroOtaKey(NSString *base) {
    return [NSString stringWithFormat:@"%@_%@", base, gNitroOtaAppVersion];
}

// MARK: - Rollback Logic

/**
 * Performs a synchronous rollback. Reads and writes UserDefaults directly.
 * Must be safe to call from a signal handler (no ObjC allocations ideally,
 * but in practice NSUserDefaults + NSJSONSerialization work reliably here).
 * Called by both signal handlers and the NSException handler.
 */
static void NitroOtaPerformRollback(const char *reason) {
    if (!gNitroOtaIsPendingValidation) return;

    NSUserDefaults *defaults = [[NSUserDefaults alloc] initWithSuiteName:kNitroOtaSuiteName];
    if (!defaults) defaults = [NSUserDefaults standardUserDefaults];

    NSString *currentVersion = [defaults stringForKey:NitroOtaKey(@"ota_version")];
    NSString *previousPath   = [defaults stringForKey:NitroOtaKey(@"ota_previous_unzipped_path")];
    NSString *previousVersion = [defaults stringForKey:NitroOtaKey(@"ota_previous_version")];

    // --- Blacklist the bad version so it is never re-downloaded ---
    if (currentVersion.length > 0) {
        NSString *blacklistJson = [defaults stringForKey:NitroOtaKey(@"ota_blacklisted_versions")] ?: @"[]";
        NSData *blacklistData = [blacklistJson dataUsingEncoding:NSUTF8StringEncoding];
        NSMutableArray *blacklist = [[[NSJSONSerialization JSONObjectWithData:blacklistData
                                                                      options:0
                                                                        error:nil] mutableCopy]
                                     ?: [NSMutableArray array] mutableCopy];
        if (![blacklist containsObject:currentVersion]) {
            [blacklist addObject:currentVersion];
            NSData *newData = [NSJSONSerialization dataWithJSONObject:blacklist options:0 error:nil];
            NSString *newJson = [[NSString alloc] initWithData:newData encoding:NSUTF8StringEncoding];
            [defaults setObject:newJson forKey:NitroOtaKey(@"ota_blacklisted_versions")];
        }
    }

    // --- Increment rollback counter ---
    NSInteger count = [defaults integerForKey:NitroOtaKey(@"ota_rollback_count")] + 1;
    [defaults setInteger:count forKey:NitroOtaKey(@"ota_rollback_count")];

    // --- Determine rollback parameters ---
    NSString *reasonStr = [NSString stringWithUTF8String:reason];
    NSString *effectiveReason = (count > 3) ? @"max_rollbacks_exceeded" : reasonStr;
    BOOL hasPrevious = previousPath.length > 0;
    NSString *toVersion = (!hasPrevious || count > 3) ? @"original" : (previousVersion ?: @"unknown");

    // --- Append to rollback history ---
    NSString *historyJson = [defaults stringForKey:NitroOtaKey(@"ota_rollback_history")] ?: @"[]";
    NSData *historyData = [historyJson dataUsingEncoding:NSUTF8StringEncoding];
    NSMutableArray *history = [[[NSJSONSerialization JSONObjectWithData:historyData
                                                                options:0
                                                                  error:nil] mutableCopy]
                                ?: [NSMutableArray array] mutableCopy];
    [history addObject:@{
        @"timestamp": @((long long)([[NSDate date] timeIntervalSince1970] * 1000)),
        @"fromVersion": currentVersion ?: @"unknown",
        @"toVersion": toVersion,
        @"reason": effectiveReason
    }];
    NSData *newHistoryData = [NSJSONSerialization dataWithJSONObject:history options:0 error:nil];
    NSString *newHistoryJson = [[NSString alloc] initWithData:newHistoryData encoding:NSUTF8StringEncoding];
    [defaults setObject:newHistoryJson forKey:NitroOtaKey(@"ota_rollback_history")];

    // --- Swap bundles or reset to original ---
    if (count > 3 || !hasPrevious) {
        // Too many rollbacks or no fallback: reset to the original app bundle
        [defaults setObject:@"" forKey:NitroOtaKey(@"ota_unzipped_path")];
        [defaults setObject:@"" forKey:NitroOtaKey(@"ota_version")];
        [defaults setInteger:0 forKey:NitroOtaKey(@"ota_rollback_count")];
    } else {
        // Promote previous bundle to current
        [defaults setObject:previousPath forKey:NitroOtaKey(@"ota_unzipped_path")];
        [defaults setObject:(previousVersion ?: @"") forKey:NitroOtaKey(@"ota_version")];
        [defaults setObject:@"" forKey:NitroOtaKey(@"ota_previous_unzipped_path")];
        [defaults setObject:@"" forKey:NitroOtaKey(@"ota_previous_version")];
    }

    // --- Clear pending validation flag ---
    [defaults setBool:NO forKey:NitroOtaKey(@"ota_pending_validation")];
    gNitroOtaIsPendingValidation = NO;

    // Must flush before the process dies
    [defaults synchronize];
}

// MARK: - Signal Handlers (must be free C functions)

static void NitroOtaSignalHandler(int sig) {
    if (gNitroOtaIsPendingValidation) {
        NitroOtaPerformRollback("crash_detected");
    }
    // Re-raise with default handler so the crash is properly reported to the OS
    signal(sig, SIG_DFL);
    raise(sig);
}

static void NitroOtaInstallSignalHandlers(void) {
    signal(SIGABRT, NitroOtaSignalHandler);
    signal(SIGILL,  NitroOtaSignalHandler);
    signal(SIGSEGV, NitroOtaSignalHandler);
    signal(SIGFPE,  NitroOtaSignalHandler);
    signal(SIGBUS,  NitroOtaSignalHandler);
    signal(SIGPIPE, NitroOtaSignalHandler);
}

// MARK: - NSException Handler

static void NitroOtaExceptionHandler(NSException *exception) {
    if (gNitroOtaIsPendingValidation) {
        NitroOtaPerformRollback("crash_detected");
    }
    // Forward to previously registered handler (e.g. Crashlytics, Sentry, etc.)
    if (gNitroOtaPreviousExceptionHandler) {
        gNitroOtaPreviousExceptionHandler(exception);
    }
}

// MARK: - NitroOtaCrashHandler

@implementation NitroOtaCrashHandler

/**
 * +load runs before main() when the ObjC runtime loads this class.
 * This guarantees the crash handler is active before any JS bundle is executed.
 * Only installs if the current OTA bundle is pending validation (i.e., not yet confirmed).
 */
+ (void)load {
    gNitroOtaAppVersion = NitroOtaGetAppVersion();

    NSUserDefaults *defaults = [[NSUserDefaults alloc] initWithSuiteName:kNitroOtaSuiteName];
    if (!defaults) defaults = [NSUserDefaults standardUserDefaults];

    gNitroOtaIsPendingValidation = [defaults boolForKey:NitroOtaKey(@"ota_pending_validation")];

    if (!gNitroOtaIsPendingValidation) {
        // Current bundle is confirmed good — no crash guard needed.
        // Normal app crashes will NOT trigger a rollback.
        return;
    }

    NitroOtaInstallSignalHandlers();

    // Save the existing exception handler so we can forward crashes to it
    gNitroOtaPreviousExceptionHandler = NSGetUncaughtExceptionHandler();
    NSSetUncaughtExceptionHandler(NitroOtaExceptionHandler);
}

+ (void)performRollbackWithReason:(NSString *)reason {
    NitroOtaPerformRollback([reason UTF8String]);
}

@end
