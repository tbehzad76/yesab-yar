import { useEffect, useMemo, useRef, useState } from "react";

import {
  formatJalali,
  isoToJalali,
  jalaliMonthLength,
  jalaliToISO,
  MONTH_NAMES,
  thisYearJalali,
  toEnDigits,
  toFaDigits,
  todayISO,
  todayJalali,
  WEEKDAYS,
  weekdayOfJalali,
} from "../lib/jalali";

interface DateInputProps {
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  required?: boolean;
  allowClear?: boolean;
  disabled?: boolean;
  id?: string;
}

export function DateInput({
  value,
  onChange,
  placeholder = "انتخاب تاریخ",
  required = false,
  allowClear = true,
  disabled = false,
  id,
}: DateInputProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selected = isoToJalali(value);
  const today = todayJalali();
  const startView = selected ?? today;
  const [view, setView] = useState({ jy: startView.jy, jm: startView.jm, jd: startView.jd });
  const [text, setText] = useState(value ? formatJalali(value) : "");

  useEffect(() => {
    setText(value ? formatJalali(value) : "");
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const base = isoToJalali(value) ?? todayJalali();
    setView({ jy: base.jy, jm: base.jm, jd: base.jd });
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const cells = useMemo(() => {
    const leading = weekdayOfJalali(view.jy, view.jm, 1);
    const length = jalaliMonthLength(view.jy, view.jm);
    const list: (number | null)[] = [];
    for (let i = 0; i < leading; i += 1) list.push(null);
    for (let day = 1; day <= length; day += 1) list.push(day);
    while (list.length % 7 !== 0) list.push(null);
    return list;
  }, [view.jy, view.jm]);

  function move(delta: number) {
    setView((current) => {
      let jm = current.jm + delta;
      let jy = current.jy;
      while (jm > 12) {
        jm -= 12;
        jy += 1;
      }
      while (jm < 1) {
        jm += 12;
        jy -= 1;
      }
      return { jy, jm, jd: current.jd };
    });
  }

  function jumpToYear(delta: number) {
    setView((current) => ({ ...current, jy: current.jy + delta }));
  }

  function pick(day: number) {
    onChange(jalaliToISO(view.jy, view.jm, day));
    setOpen(false);
  }

  function handleTyped(raw: string) {
    const cleaned = toEnDigits(raw).trim();
    const match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(cleaned);
    if (match) {
      const jy = Number(match[1]);
      const jm = Number(match[2]);
      const jd = Number(match[3]);
      if (jm >= 1 && jm <= 12 && jd >= 1 && jd <= jalaliMonthLength(jy, jm)) {
        onChange(jalaliToISO(jy, jm, jd));
        setView({ jy, jm, jd });
      }
    }
  }

  const currentYear = thisYearJalali();
  const years: number[] = [];
  for (let year = currentYear + 5; year >= currentYear - 90; year -= 1) {
    years.push(year);
  }
  if (!years.includes(view.jy)) {
    years.push(view.jy);
    years.sort((a, b) => b - a);
  }

  return (
    <div className="date-field" ref={wrapperRef}>
      <div className={`input date-trigger${value ? "" : " placeholder"}`}>
        <input
          className="date-typed"
          value={text}
          placeholder={placeholder}
          disabled={disabled}
          inputMode="numeric"
          onChange={(event) => {
            setText(event.target.value);
            handleTyped(event.target.value);
          }}
          onFocus={() => !disabled && setOpen(true)}
          onBlur={() => setText(value ? formatJalali(value) : "")}
        />
        <button
          type="button"
          className="date-toggle"
          tabIndex={-1}
          aria-label="باز کردن تقویم"
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setOpen((previous) => !previous)}
        >
          📅
        </button>
      </div>

      <input
        className="date-native"
        type="date"
        id={id}
        tabIndex={-1}
        aria-hidden="true"
        required={required}
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
      />

      {open && !disabled && (
        <div className="date-popup" role="dialog">
          <div className="date-popup-head">
            <button type="button" className="date-nav" onClick={() => jumpToYear(-1)}>
              «
            </button>
            <button type="button" className="date-nav" onClick={() => move(-1)}>
              ›
            </button>
            <select
              className="date-select"
              value={view.jm}
              onChange={(event) => setView({ ...view, jm: Number(event.target.value) })}
            >
              {MONTH_NAMES.map((name, index) => (
                <option key={name} value={index + 1}>
                  {name}
                </option>
              ))}
            </select>
            <select
              className="date-select"
              value={view.jy}
              onChange={(event) => setView({ ...view, jy: Number(event.target.value) })}
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {toFaDigits(year)}
                </option>
              ))}
            </select>
            <button type="button" className="date-nav" onClick={() => move(1)}>
              ‹
            </button>
            <button type="button" className="date-nav" onClick={() => jumpToYear(1)}>
              »
            </button>
          </div>

          <div className="date-grid date-weekdays">
            {WEEKDAYS.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="date-grid">
            {cells.map((day, index) => {
              if (day === null) {
                return <span key={`empty-${index}`} className="date-empty" />;
              }
              const isSelected =
                selected !== null &&
                selected.jy === view.jy &&
                selected.jm === view.jm &&
                selected.jd === day;
              const isToday =
                today.jy === view.jy && today.jm === view.jm && today.jd === day;
              return (
                <button
                  type="button"
                  key={`day-${day}`}
                  className={`date-day${isSelected ? " selected" : ""}${
                    isToday ? " today" : ""
                  }`}
                  onClick={() => pick(day)}
                >
                  {toFaDigits(day)}
                </button>
              );
            })}
          </div>

          <div className="date-popup-foot">
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                onChange(todayISO());
                setOpen(false);
              }}
            >
              امروز
            </button>
            {allowClear && !required && value && (
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                پاک کردن
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
