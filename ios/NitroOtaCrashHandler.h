//
//  NitroOtaCrashHandler.h
//  NitroOta
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * NitroOtaCrashHandler installs OS-level crash handlers (Unix signals +
 * NSException handler) that automatically roll back a new OTA bundle if the
 * app crashes before the bundle is confirmed as working.
 *
 * Uses the "pending confirmation" pattern — crash handlers are ONLY active
 * when the current OTA bundle has not yet been confirmed via confirmBundle().
 * This prevents normal app crashes from incorrectly triggering a rollback.
 *
 * Installed automatically via the Objective-C +load method — no user code needed.
 */
@interface NitroOtaCrashHandler : NSObject

/**
 * Manually triggers a rollback with a custom reason string.
 * Called by Swift code when the user explicitly calls markCurrentBundleAsBad().
 * @param reason A human-readable string describing why the rollback is being triggered.
 */
+ (void)performRollbackWithReason:(NSString *)reason;

@end

NS_ASSUME_NONNULL_END
