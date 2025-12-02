//
//  NitroOtaBridge.m
//  NitroOta
//
//  Created by Ritesh Shukla on 27/11/25.
//

#import "NitroOtaBridge.h"
#import <React/RCTReloadCommand.h>

@implementation NitroOtaBridge

+ (void)triggerReloadWithReason:(NSString *)reason {
    RCTTriggerReloadCommandListeners(reason);
}

@end


