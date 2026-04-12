import { useMemo, useState } from "react";
import type {
  GtfsData,
  GtfsRoute,
  GtfsTrip,
  GtfsStopTime,
} from "@/lib/gtfs-parser";
import {
  formatTime,
  getRouteColor,
  getRouteTextColor,
  getServiceDays,
} from "@/lib/gtfs-parser";
import { RoutesColumn } from "./RoutesColumn";
import { TripsColumn } from "./TripsColumn";
import { StopTimesColumn } from "./StopTimesColumn";

interface Props {
  data: GtfsData;
}

export interface EnrichedTrip {
  trip: GtfsTrip;
  firstStop: { name: string; time: string };
  lastStop: { name: string; time: string };
  days: Record<string, boolean>;
}

export function VisualizationStep({ data }: Props) {
  const [selectedRoute, setSelectedRoute] = useState<GtfsRoute | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<GtfsTrip | null>(null);

  // Index stops by id
  const stopsMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of data.stops) m.set(s.stop_id, s.stop_name);
    return m;
  }, [data.stops]);

  // Index stop_times by trip_id
  const stopTimesByTrip = useMemo(() => {
    const m = new Map<string, GtfsStopTime[]>();
    for (const st of data.stopTimes) {
      let arr = m.get(st.trip_id);
      if (!arr) {
        arr = [];
        m.set(st.trip_id, arr);
      }
      arr.push(st);
    }
    // Sort each by stop_sequence
    for (const arr of m.values()) {
      arr.sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence));
    }
    return m;
  }, [data.stopTimes]);

  // Trips for selected route
  const enrichedTrips = useMemo<EnrichedTrip[]>(() => {
    if (!selectedRoute) return [];
    const routeTrips = data.trips.filter(
      (t) => t.route_id === selectedRoute.route_id
    );

    return routeTrips
      .map((trip) => {
        const sts = stopTimesByTrip.get(trip.trip_id) || [];
        if (sts.length === 0) return null;
        const first = sts[0];
        const last = sts[sts.length - 1];
        return {
          trip,
          firstStop: {
            name: stopsMap.get(first.stop_id) || first.stop_id,
            time: formatTime(first.departure_time),
          },
          lastStop: {
            name: stopsMap.get(last.stop_id) || last.stop_id,
            time: formatTime(last.arrival_time),
          },
          days: getServiceDays(trip.service_id, data.calendar, data.calendarDates),
        };
      })
      .filter(Boolean)
      .sort((a, b) =>
        (a!.firstStop.time).localeCompare(b!.firstStop.time)
      ) as EnrichedTrip[];
  }, [selectedRoute, data, stopTimesByTrip, stopsMap]);

  // Stop times for selected trip
  const tripStopTimes = useMemo(() => {
    if (!selectedTrip) return [];
    const sts = stopTimesByTrip.get(selectedTrip.trip_id) || [];
    return sts.map((st) => ({
      ...st,
      stopName: stopsMap.get(st.stop_id) || st.stop_id,
      arrivalFormatted: formatTime(st.arrival_time),
      departureFormatted: formatTime(st.departure_time),
    }));
  }, [selectedTrip, stopTimesByTrip, stopsMap]);

  // Service details for selected trip
  const selectedTripDays = useMemo(() => {
    if (!selectedTrip) return null;
    return getServiceDays(selectedTrip.service_id, data.calendar, data.calendarDates);
  }, [selectedTrip, data.calendar, data.calendarDates]);

  // Calendar dates for selected trip
  const selectedTripCalendar = useMemo(() => {
    if (!selectedTrip) return null;
    const cal = data.calendar.find(
      (c) => c.service_id === selectedTrip.service_id
    );
    const calDates = data.calendarDates.filter(
      (cd) => cd.service_id === selectedTrip.service_id
    );
    return { cal, calDates };
  }, [selectedTrip, data.calendar, data.calendarDates]);

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border px-6 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
          <span className="text-sm font-bold text-primary">G</span>
        </div>
        <h1 className="font-[family-name:var(--font-heading)] text-lg font-semibold text-foreground">
          GTFS Viewer
        </h1>
        <span className="text-xs text-muted-foreground">
          {data.routes.length} lignes · {data.trips.length} courses · {data.stops.length} arrêts
        </span>
      </header>

      {/* 3-column layout */}
      <div className="flex flex-1 overflow-hidden">
        <RoutesColumn
          routes={data.routes}
          selectedRoute={selectedRoute}
          onSelectRoute={(r) => {
            setSelectedRoute(r);
            setSelectedTrip(null);
          }}
        />
        <TripsColumn
          trips={enrichedTrips}
          selectedRoute={selectedRoute}
          selectedTrip={selectedTrip}
          onSelectTrip={setSelectedTrip}
        />
        <StopTimesColumn
          stopTimes={tripStopTimes}
          selectedTrip={selectedTrip}
          days={selectedTripDays}
          calendarInfo={selectedTripCalendar}
        />
      </div>
    </div>
  );
}
