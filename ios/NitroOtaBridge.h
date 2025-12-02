//  NitroOtaBridge.h
//  NitroOta
//
//  Created by Ritesh Shukla on 27/11/25.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface NitroOtaBridge : NSObject

+ (void)triggerReloadWithReason:(NSString *)reason;

@end

NS_ASSUME_NONNULL_END
