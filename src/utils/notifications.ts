import { notifications } from '@mantine/notifications';
import classes from './notify.module.css';

export interface RevisitNotification {
  title: string;
  message: string;
  color?: string;
  animated?: boolean;
  autoClose?: number | false;
}

export const showNotification = (notification: RevisitNotification) => {
  const {
    title, message, color, animated = true, autoClose,
  } = notification;
  return notifications.show({
    title,
    message,
    position: 'top-center',
    classNames: classes,
    color: color || 'blue',
    autoClose: autoClose ?? (color === 'red' || color === 'yellow' ? false : 5000), // 'warnings' and 'errors' never auto-close. Successes or defaults auto close after 5 seconds.
    style: animated ? undefined : {
      maxHeight: 200,
      opacity: 1,
      transform: 'none',
      transition: 'none',
    },
  });
};

export const hideNotification = (notificationId: string) => {
  notifications.hide(notificationId);
};
