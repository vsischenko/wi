const formatDeployLabel = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export const DeployBadge = () => {
  const sha = __GIT_SHA_SHORT__;
  const title =
    sha.length > 0
      ? `Релиз ${__APP_VERSION_BASE__} · сборка ${__APP_VERSION__} · ${formatDeployLabel(__BUILD_ISO__)} UTC · ${sha}`
      : `Релиз ${__APP_VERSION_BASE__} · ${formatDeployLabel(__BUILD_ISO__)} (локальная сборка)`;

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
      <span className="deploy-badge__date">{formatDeployLabel(__BUILD_ISO__)}</span>
    </div>
  );
};
