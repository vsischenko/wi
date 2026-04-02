import { DEPLOY_STAMP_GMT2_LABEL, DEPLOY_STAMP_ISO } from '../buildUserStamp';

/** Fallback when stamp file not filled yet (e.g. first clone): same rules as stamp script (fixed UTC+2). */
const formatIsoAsGmt2 = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const gmt2 = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Etc/GMT-2',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d);
  return `${gmt2} GMT+2`;
};

export const DeployBadge = () => {
  const sha = __GIT_SHA_SHORT__;
  const stampIso = DEPLOY_STAMP_ISO.length > 0 ? DEPLOY_STAMP_ISO : __BUILD_ISO__;
  const stampGmt2 =
    DEPLOY_STAMP_GMT2_LABEL.length > 0 ? DEPLOY_STAMP_GMT2_LABEL : formatIsoAsGmt2(__BUILD_ISO__);

  const title =
    sha.length > 0
      ? `Release ${__APP_VERSION_BASE__} · ${__APP_VERSION__} · push stamp ${stampIso} (UTC) → ${stampGmt2} · ${sha}`
      : `Release ${__APP_VERSION_BASE__} · local · ${stampIso} (UTC) → ${stampGmt2}`;

  return (
    <div className="deploy-badge" title={title}>
      <span className="deploy-badge__version">v{__APP_VERSION__}</span>
      {sha ? (
        <>
          <span className="deploy-badge__sep">·</span>
          <span className="deploy-badge__sha">{sha}</span>
        </>
      ) : null}
      <span className="deploy-badge__sep">·</span>
      <span className="deploy-badge__date">{stampGmt2}</span>
    </div>
  );
};
