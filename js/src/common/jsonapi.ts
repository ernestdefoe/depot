import app from 'flarum/common/app';

/*
 * Depot's resources, read back into the plain shapes its pages draw: a
 * resource's attributes with its number as `id`.
 */

export interface ResourceObject {
  type: string;
  id: string;
  attributes?: Record<string, unknown>;
}

export interface Document {
  data: ResourceObject | ResourceObject[];
  meta?: Record<string, unknown>;
  links?: { next?: string };
}

export const flatten = <T>(resource: ResourceObject): T => ({ id: Number(resource.id), ...resource.attributes }) as T;

const url = (path: string) => `${app.forum.attribute('apiUrl')}/${path}`;

export const resources = {
  get: (path: string, params?: Record<string, unknown>) => app.request<Document>({ method: 'GET', url: url(path), params }),

  create: <T>(type: string, attributes: Record<string, unknown>) =>
    app
      .request<Document>({ method: 'POST', url: url(type), body: { data: { type, attributes } } })
      .then((doc) => flatten<T>(doc.data as ResourceObject)),

  update: <T>(type: string, id: number, attributes: Record<string, unknown>) =>
    app
      .request<Document>({ method: 'PATCH', url: url(`${type}/${id}`), body: { data: { type, id: String(id), attributes } } })
      .then((doc) => flatten<T>(doc.data as ResourceObject)),

  remove: (type: string, id: number) => app.request<void>({ method: 'DELETE', url: url(`${type}/${id}`) }),
};
