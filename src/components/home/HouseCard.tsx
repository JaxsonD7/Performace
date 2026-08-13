import { Card, CardHeader } from '@/components/ui/primitives';
import { timeAgo } from '@/lib/date';
import { useStore } from '@/store/store';

/**
 * The one card on Home fed by something other than this app — Home
 * Assistant writes ha-status.json itself, this just displays it. Nothing
 * here is ever written back; presence/temperature/humidity are read-only
 * facts from the house, same as the digest cards are read-only facts from
 * Gmail.
 */
export function HouseCard() {
  const { state, haStatus } = useStore();
  const configured = !!state.settings.haReadToken;

  if (!configured) return null;

  return (
    <Card>
      <CardHeader
        title="House"
        icon="🏠"
        subtitle={haStatus ? `checked ${timeAgo(haStatus.generated_at)}` : 'Waiting on Home Assistant'}
      />
      <div className="card-pad">
        {!haStatus ? (
          <p className="py-4 text-center text-sm text-ink-muted">
            Nothing written yet — this fills in once Home Assistant pushes ha-status.json.
          </p>
        ) : (
          <div className="flex items-center justify-around gap-2 py-1 text-center">
            <div>
              <p className="hud-mono text-2xl font-semibold text-ink">
                {haStatus.home === null ? '—' : haStatus.home ? '🏠' : '🚪'}
              </p>
              <p className="mt-0.5 text-[11px] text-ink-muted">{haStatus.home === null ? 'Unknown' : haStatus.home ? 'Home' : 'Away'}</p>
            </div>
            <div>
              <p className="hud-mono text-2xl font-semibold text-ink">
                {haStatus.temperature_f == null ? '—' : Math.round(haStatus.temperature_f)}°
              </p>
              <p className="mt-0.5 text-[11px] text-ink-muted">Temp</p>
            </div>
            <div>
              <p className="hud-mono text-2xl font-semibold text-ink">
                {haStatus.humidity_pct == null ? '—' : Math.round(haStatus.humidity_pct)}%
              </p>
              <p className="mt-0.5 text-[11px] text-ink-muted">Humidity</p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
