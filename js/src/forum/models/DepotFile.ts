import Model from 'flarum/common/Model';

/*
 * The notification subject's model. Not optional: the store builds every
 * notification's subject with `new this.models[type]` and an unregistered
 * type kills the whole notification list, for everybody.
 */
export default class DepotFile extends Model {
  title = Model.attribute<string>('title');
  slug = Model.attribute<string>('slug');
}
