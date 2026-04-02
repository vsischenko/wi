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
  /** Bundle build time (fresh on every `vite build`, including Vercel). */
  const buildIso = __BUILD_ISO__;
  const stampGmt2 = formatIsoAsGmt2(buildIso);
  const pushStampExtra =
    DEPLOY_STAMP_ISO.length > 0 && DEPLOY_STAMP_ISO !== buildIso
      ? ` · pre-push stamp (repo file): ${DEPLOY_STAMP_ISO} → ${DEPLOY_STAMP_GMT2_LABEL}`
      : '';

  const title =
    sha.length > 0
      ? `Release ${__APP_VERSION_BASE__} · ${__APP_VERSION__} · build ${buildIso} (UTC) → ${stampGmt2}${pushStampExtra} · ${sha}`
      : `Release ${__APP_VERSION_BASE__} · local · build ${buildIso} (UTC) → ${stampGmt2}${pushStampExtra}`;

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
