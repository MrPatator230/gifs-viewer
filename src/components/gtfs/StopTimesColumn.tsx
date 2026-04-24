import { useState } from "react";
import type { GtfsTrip, GtfsCalendar, GtfsCalendarDate, GtfsStopTime } from "@/lib/gtfs-parser";
import { MapPin, Calendar, MessageSquare } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface EnrichedStopTime extends GtfsStopTime {
  stopName: string;
  arrivalFormatted: string;
  departureFormatted: string;
}

interface Props {
  stopTimes: EnrichedStopTime[];
  selectedTrip: GtfsTrip | null;
  days: Record<string, boolean> | null;
  calendarInfo: { cal: GtfsCalendar | undefined; calDates: GtfsCalendarDate[] } | null;
  comment: string;
  onCommentChange: (comment: string) => void;
}

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function formatGtfsDate(d: string): string {
  if (!d || d.length !== 8) return d;
  return `${d.slice(6, 8)}/${d.slice(4, 6)}/${d.slice(0, 4)}`;
}

function parseGtfsDate(d: string): Date | null {
  if (!d || d.length !== 8) return null;
  return new Date(Number(d.slice(0, 4)), Number(d.slice(4, 6)) - 1, Number(d.slice(6, 8)));
}

function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function getActiveDates(
  cal: GtfsCalendar | undefined,
  calDates: GtfsCalendarDate[]
): Set<string> {
  const dates = new Set<string>();

  if (cal) {
    const start = parseGtfsDate(cal.start_date);
    const end = parseGtfsDate(cal.end_date);
    if (start && end) {
      const dayMap = [
        cal.sunday === "1",
        cal.monday === "1",
        cal.tuesday === "1",
        cal.wednesday === "1",
        cal.thursday === "1",
        cal.friday === "1",
        cal.saturday === "1",
      ];
      const cur = new Date(start);
      while (cur <= end) {
        if (dayMap[cur.getDay()]) {
          dates.add(toKey(cur));
        }
        cur.setDate(cur.getDate() + 1);
      }
    }
  }

  for (const cd of calDates) {
    const key = cd.date;
    if (cd.exception_type === "1") dates.add(key);
    if (cd.exception_type === "2") dates.delete(key);
  }

  return dates;
}

function MiniCalendar({
  cal,
  calDates,
}: {
  cal: GtfsCalendar | undefined;
  calDates: GtfsCalendarDate[];
}) {
  const activeDates = getActiveDates(cal, calDates);

  let start: Date | null = cal ? parseGtfsDate(cal.start_date) : null;
  let end: Date | null = cal ? parseGtfsDate(cal.end_date) : null;

  // Fallback: derive bounds from calendar_dates when calendar.txt has no entry
  if ((!start || !end) && calDates.length > 0) {
    const sorted = [...calDates]
      .map((cd) => cd.date)
      .filter((d) => d && d.length === 8)
      .sort();
    if (sorted.length > 0) {
      start = parseGtfsDate(sorted[0]);
      end = parseGtfsDate(sorted[sorted.length - 1]);
    }
  }

  if (!start || !end) {
    return (
      <p className="text-[10px] text-muted-foreground">
        Aucune information de calendrier disponible.
      </p>
    );
  }

  const months: { year: number; month: number }[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cur <= endMonth) {
    months.push({ year: cur.getFullYear(), month: cur.getMonth() });
    cur.setMonth(cur.getMonth() + 1);
  }

  const displayMonths = months.slice(0, 6);

  const monthNames = [
    "Jan", "Fév", "Mar", "Avr", "Mai", "Jun",
    "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc",
  ];

  return (
    <div className="space-y-3">
      {displayMonths.map(({ year, month }) => {
        const firstDay = new Date(year, month, 1);
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const startDow = (firstDay.getDay() + 6) % 7;

        const cells: (number | null)[] = [];
        for (let i = 0; i < startDow; i++) cells.push(null);
        for (let d = 1; d <= daysInMonth; d++) cells.push(d);

        return (
          <div key={`${year}-${month}`}>
            <p className="mb-1 text-[10px] font-semibold text-muted-foreground">
              {monthNames[month]} {year}
            </p>
            <div className="grid grid-cols-7 gap-px">
              {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
                <span
                  key={i}
                  className="text-center text-[9px] text-muted-foreground"
                >
                  {d}
                </span>
              ))}
              {cells.map((day, i) => {
                if (day === null)
                  return <span key={i} />;
                const dateKey = `${year}${String(month + 1).padStart(2, "0")}${String(day).padStart(2, "0")}`;
                const isActive = activeDates.has(dateKey);
                return (
                  <span
                    key={i}
                    className={`flex h-5 w-5 items-center justify-center rounded-sm text-[9px] ${
                      isActive
                        ? "bg-primary/30 text-primary font-medium"
                        : "text-muted-foreground/40"
                    }`}
                  >
                    {day}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
      {months.length > 6 && (
        <p className="text-[10px] text-muted-foreground">
          +{months.length - 6} mois supplémentaires…
        </p>
      )}
    </div>
  );
}

export function StopTimesColumn({ stopTimes, selectedTrip, days, calendarInfo, comment, onCommentChange }: Props) {
  const [showCalendar, setShowCalendar] = useState(false);

  if (!selectedTrip) {
    return (
      <div className="flex w-96 shrink-0 items-center justify-center">
        <div className="text-center text-muted-foreground">
          <MapPin className="mx-auto mb-2 h-8 w-8 opacity-40" />
          <p className="text-sm">Sélectionnez un horaire</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-96 shrink-0 flex-col">
      <div className="border-b border-border p-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-[family-name:var(--font-heading)] text-sm font-semibold text-foreground">
              Détail
              {selectedTrip.trip_short_name && ` — Train ${selectedTrip.trip_short_name}`}
            </h2>
            {selectedTrip.trip_headsign && (
              <p className="text-xs text-muted-foreground">{selectedTrip.trip_headsign}</p>
            )}
          </div>
          {calendarInfo && (
            <button
              onClick={() => setShowCalendar(!showCalendar)}
              className={`rounded-md p-1.5 transition-colors ${
                showCalendar ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted"
              }`}
              title="Calendrier de circulation"
            >
              <Calendar className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Service days */}
      {days && (
        <div className="border-b border-border px-4 py-3">
          <div className="flex gap-1">
            {DAY_LABELS.map((day) => (
              <span
                key={day}
                className={`rounded px-2 py-1 text-xs font-medium ${
                  days[day]
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {day}
              </span>
            ))}
          </div>
          {calendarInfo?.cal && (
            <p className="mt-2 text-[10px] text-muted-foreground">
              Du {formatGtfsDate(calendarInfo.cal.start_date)} au{" "}
              {formatGtfsDate(calendarInfo.cal.end_date)}
            </p>
          )}
        </div>
      )}

      {/* Calendar toggle */}
      {showCalendar && calendarInfo && (
        <div className="border-b border-border px-4 py-3">
          <MiniCalendar cal={calendarInfo.cal} calDates={calendarInfo.calDates} />
        </div>
      )}

      {/* Comment section */}
      <div className="border-b border-border px-4 py-3">
        <div className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <MessageSquare className="h-3.5 w-3.5" />
          Commentaire
        </div>
        <Textarea
          value={comment}
          onChange={(e) => onCommentChange(e.target.value)}
          placeholder="Aucun commentaire…"
          className="min-h-[48px] resize-none bg-muted/50 text-xs"
          rows={2}
        />
      </div>

      {/* Stop times list */}
      <div className="flex-1 overflow-y-auto">
        {stopTimes.map((st, i) => (
          <div
            key={`${st.stop_id}-${st.stop_sequence}`}
            className="flex items-start gap-3 border-b border-border px-4 py-2.5"
          >
            <div className="flex flex-col items-center pt-1.5">
              <div className="h-2.5 w-2.5 rounded-full border-2 border-primary bg-background" />
              {i < stopTimes.length - 1 && (
                <div className="mt-0.5 h-6 w-px bg-border" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground">
                {st.stopName}{" "}
                <span className="text-primary">
                  ({st.arrivalFormatted}
                  {st.arrivalFormatted !== st.departureFormatted
                    ? ` - ${st.departureFormatted}`
                    : ""}
                  )
                </span>
              </p>
              {(st.platform || st.stop_headsign) && (
                <p className="text-xs text-muted-foreground">
                  {st.platform && `Voie ${st.platform}`}
                  {st.platform && st.stop_headsign && " · "}
                  {st.stop_headsign}
                </p>
              )}
            </div>
            <span className="shrink-0 font-[family-name:var(--font-mono)] text-xs text-muted-foreground">
              #{String(i + 1).padStart(2, "0")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
