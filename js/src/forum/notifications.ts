import app from 'flarum/forum/app';
import Notification from 'flarum/forum/components/Notification';
import type DepotFile from './models/DepotFile';

const t = (key: string, params: Record<string, string> = {}) => app.translator.trans(`ernestdefoe-depot.forum.${key}`, params);

/** A notification about a file: its text, and a link to the file. */
abstract class FileNotification extends Notification {
  protected file() {
    return this.attrs.notification.subject() as DepotFile | null | undefined;
  }

  href() {
    const file = this.file();
    return file ? app.route('depot.file', { slug: file.slug() }) : app.route('depot.index');
  }

  excerpt() {
    return this.file()?.title() || null;
  }
}

export class NewVersionNotification extends FileNotification {
  icon() {
    return 'fas fa-box-open';
  }

  content() {
    return t('notifications.new_version', { version: this.attrs.notification.content<{ version?: string }>()?.version || '' });
  }
}

export class FileApprovedNotification extends FileNotification {
  icon() {
    return 'fas fa-check';
  }

  content() {
    return t('notifications.approved');
  }
}
