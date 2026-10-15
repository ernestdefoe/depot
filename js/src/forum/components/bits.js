import app from 'flarum/forum/app';
import Icon from 'flarum/common/components/Icon';
import Tooltip from 'flarum/common/components/Tooltip';
import { category, rootOf, users, number } from '../data';

export const t = (key, params) => app.translator.trans(`ernestdefoe-depot.forum.${key}`, params);

/** A 30-day trend line. Values only, no axes: it shows direction, the number beside it shows size. */
export function Sparkline({ values, width = 96, height = 28, className = '' }) {
  const max = Math.max(...values, 1);
  const step = width / (values.length - 1);
  const pts = values.map((v, i) => [i * step, height - 2 - (v / max) * (height - 4)]);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
  const [lx, ly] = pts[pts.length - 1];

  return (
    <svg className={`Depot-spark ${className}`} viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true">
      <path className="Depot-spark-area" d={`${line}L${width},${height}L0,${height}Z`} />
      <path className="Depot-spark-line" d={line} />
      <circle className="Depot-spark-dot" cx={lx} cy={ly} r="2.5" />
    </svg>
  );
}

export function Stars({ value, size = '' }) {
  const full = Math.round(value * 2) / 2;
  return (
    <span className={`Depot-stars ${size}`} aria-label={t('rating_label', { rating: value.toFixed(1) })}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon name={i <= full ? 'fas fa-star' : i - 0.5 === full ? 'fas fa-star-half-alt' : 'far fa-star'} />
      ))}
    </span>
  );
}

/** Flarum's own avatar markup, fed from sample users instead of the store. */
export function Avatar({ user, className = '' }) {
  const u = users[user];
  return (
    <span className={`Avatar ${className}`} style={{ '--avatar-bg': u.color }} title={u.username}>
      {u.username.charAt(0).toUpperCase()}
    </span>
  );
}

export function UserChip({ user }) {
  return (
    <span className="Depot-user">
      {Avatar({ user, className: "Avatar--mini" })}
      <span className="username">{users[user].username}</span>
    </span>
  );
}

/** Root category as a filled label, the subcategory beside it as an outline — Flarum's tag-label language. */
export function CategoryLabels({ slug, link = true }) {
  const c = category(slug);
  const root = rootOf(c);
  const label = (cat, outline) => {
    const attrs = {
      className: `Depot-label ${outline ? 'Depot-label--outline' : ''}`,
      style: { '--label-color': cat.color },
    };
    return link ? (
      <a {...attrs} href={app.route('depot.category', { slug: cat.slug })} onclick={(e) => e.stopPropagation()}>
        {cat.name}
      </a>
    ) : (
      <span {...attrs}>{cat.name}</span>
    );
  };

  return (
    <span className="Depot-labels">
      {label(root)}
      {c.parent ? label(c, true) : null}
    </span>
  );
}

export function SourceBadge({ file }) {
  if (file.source === 'github')
    return (
      <Tooltip text={t('source.github_tooltip', { repo: file.repo })}>
        <span className="Depot-badge Depot-badge--github">
          <Icon name="fab fa-github" /> GitHub
        </span>
      </Tooltip>
    );
  if (file.source === 'link')
    return (
      <Tooltip text={t('source.link_tooltip', { host: file.host })}>
        <span className="Depot-badge">
          <Icon name="fas fa-external-link-alt" /> {file.host}
        </span>
      </Tooltip>
    );
  return null;
}

export const Count = ({ icon, value, label }) => (
  <span className="Depot-count" title={label}>
    <Icon name={icon} /> {number(value)}
  </span>
);
