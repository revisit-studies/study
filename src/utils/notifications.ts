import { notifications } from '@mantine/notifications';
import classes from './notify.module.css';

export interface RevisitNotification {
  title: string;
  message: string;
  color?: string;
}

export const showNotification = (notification: RevisitNotification) => {
  const { title, message, color } = notification;
  notifications.show({
    title,
    message,
    position: 'top-center',
    classNames: classes,
    color: color || 'blue',
    autoClose: color === 'red' || color === 'yellow' ? false : 5000, // 'warnings' and 'errors' never auto-close. Successes or defaults auto close after 5 seconds.
  });
};
