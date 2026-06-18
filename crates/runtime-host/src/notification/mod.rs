mod dispatcher;

pub use dispatcher::{
    decide_notification_plan, DesktopNotifier, DesktopNotifierSlot, NotificationDeliveryGameState,
    NotificationDeliveryPlan, NotificationDeliveryPreferences, NotificationDispatcher,
    NotificationDispatcherDeps,
};
