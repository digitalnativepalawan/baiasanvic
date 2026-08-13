/**
 * INVESTORS EDITOR — full admin control over the investor section.
 *
 * Every block of the investor layout is editable here: header copy, projects
 * (add / edit / delete with images), headline stats, unit typologies with
 * prices and renderings, budget injected vs allocated, capital snapshot,
 * timeline, circle model, benefits and the closing call-to-action.
 */

import React, { useRef, useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, Images } from "lucide-react";
import {
  useSite,
  DEFAULT_INVESTORS,
  InvestorProject,
  InvestorUnit,
  InvestorBudgetItem,
  InvestorCapitalRow,
  InvestorTimelineItem,
  InvestorBenefit,
  InvestorStat,
  InvestorImage,
} from "../context/SiteContext";

interface Props {
  onUpload: (file: File, cb: (url: string) => void) => void;
  acceptImage: string;
  imageGuidance: string;
}

const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const labelCls = "block text-[9px] tracking-[0.2em] uppercase text-luxury-500 font-sans mb-1.5";
const inputCls =
  "w-full bg-luxury-900 border border-luxury-800 focus:border-gold-500 outline-none px-3 py-2 text-xs text-luxury-100 font-sans rounded-sm";
const cardCls = "border border-luxury-800 rounded-sm p-4 space-y-3 bg-luxury-950/60";
const addBtnCls =
  "inline-flex items-center gap-2 border border-gold-500/60 text-gold-300 px-4 py-2 text-[10px] tracking-[0.2em] uppercase font-sans hover:bg-gold-500 hover:text-white transition-colors";
const delBtnCls = "text-luxury-500 hover:text-red-400 transition-colors";

function Field({
  label,
  value,
  onChange,
  textarea,
  type = "text",
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  textarea?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className={`${inputCls} resize-y`} />
      ) : (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} />
      )}
    </div>
  );
}

function Block({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-luxury-800 rounded-sm">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-[11px] tracking-[0.2em] uppercase font-sans text-luxury-200 hover:text-gold-300 transition-colors"
      >
        <span>{title}</span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {open && <div className="px-4 pb-5 space-y-4 border-t border-luxury-800/70 pt-4">{children}</div>}
    </div>
  );
}

export default function InvestorsEditor({ onUpload, acceptImage, imageGuidance }: Props) {
  const { investors: inv, updateInvestors } = useSite();

  const patchList = <T,>(key: keyof typeof inv, list: T[]) => updateInvestors({ [key]: list } as never);

  const editItem = <T extends { id: string }>(key: keyof typeof inv, list: T[], id: string, data: Partial<T>) =>
    patchList(key, list.map((i) => (i.id === id ? { ...i, ...data } : i)));

  const removeItem = <T extends { id: string }>(key: keyof typeof inv, list: T[], id: string) =>
    patchList(key, list.filter((i) => i.id !== id));

  /* ── Multi-image galleries ──────────────────────────────────────────
     invRef always points at the newest state so several uploads finishing
     one after another all append instead of overwriting each other. */
  const invRef = useRef(inv);
  invRef.current = inv;

  type GalleryTarget = { list: "projects" | "units"; id: string } | { list: "section" };

  const readGallery = (t: GalleryTarget): InvestorImage[] => {
    const cur = invRef.current;
    if (t.list === "section") return cur.gallery ?? [];
    const items = (cur[t.list] as Array<InvestorProject | InvestorUnit>) || [];
    return items.find((i) => i.id === t.id)?.gallery ?? [];
  };

  const writeGallery = (t: GalleryTarget, gallery: InvestorImage[]) => {
    const cur = invRef.current;
    if (t.list === "section") {
      updateInvestors({ gallery });
      invRef.current = { ...cur, gallery };
      return;
    }
    const items = (cur[t.list] as Array<InvestorProject | InvestorUnit>) || [];
    const next = items.map((i) => (i.id === t.id ? { ...i, gallery } : i));
    updateInvestors({ [t.list]: next } as never);
    invRef.current = { ...cur, [t.list]: next } as typeof cur;
  };

  const addImages = (t: GalleryTarget, files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) =>
      onUpload(file, (url) =>
        writeGallery(t, [...readGallery(t), { id: uid("img"), url, caption: "" }]),
      ),
    );
  };

  const GalleryEditor = ({ target, label }: { target: GalleryTarget; label: string }) => {
    const images = readGallery(target);
    return (
      <div>
        <label className={labelCls}>
          <span className="inline-flex items-center gap-2">
            <Images size={11} /> {label} ({images.length})
          </span>
        </label>
        {images.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
            {images.map((img) => (
              <div key={img.id} className="space-y-1.5">
                <div className="relative">
                  <img src={img.url} alt="" className="w-full h-20 object-cover rounded-sm border border-luxury-800" />
                  <button
                    type="button"
                    title="Remove image"
                    onClick={() => writeGallery(target, readGallery(target).filter((i) => i.id !== img.id))}
                    className="absolute top-1 right-1 bg-luxury-950/80 border border-luxury-700 text-luxury-300 hover:text-red-400 p-1 rounded-sm"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
                <input
                  value={img.caption}
                  placeholder="Caption (e.g. Ground floor plan)"
                  onChange={(e) =>
                    writeGallery(
                      target,
                      readGallery(target).map((i) => (i.id === img.id ? { ...i, caption: e.target.value } : i)),
                    )
                  }
                  className={`${inputCls} !py-1.5 text-[10px]`}
                />
              </div>
            ))}
          </div>
        )}
        <input
          type="file"
          multiple
          accept={acceptImage}
          onChange={(e) => {
            addImages(target, e.target.files);
            e.target.value = "";
          }}
          className="w-full text-xs text-luxury-200"
        />
        <p className="mt-1 text-[9px] tracking-wider text-luxury-500 font-sans uppercase">
          Select multiple files at once · {imageGuidance}
        </p>
      </div>
    );
  };



  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="font-serif text-2xl text-luxury-100 font-light">Investor Section</h3>
        <p className="text-xs text-luxury-400 font-sans font-light">
          Add, edit or delete every part of the investor layout — projects, unit prices, renderings, budget injected
          and timeline. Changes save automatically.
        </p>
      </div>

      <label className="flex items-center gap-3 text-xs text-luxury-200 font-sans">
        <input
          type="checkbox"
          checked={inv.enabled}
          onChange={(e) => updateInvestors({ enabled: e.target.checked })}
          className="accent-current"
        />
        Show the Investors section on the site
      </label>

      {/* HEADER */}
      <Block title="Header & intro" defaultOpen>
        <Field label="Eyebrow" value={inv.eyebrow} onChange={(v) => updateInvestors({ eyebrow: v })} />
        <Field label="Nav label" value={inv.navLabel} onChange={(v) => updateInvestors({ navLabel: v })} />
        <Field label="Headline" value={inv.title} onChange={(v) => updateInvestors({ title: v })} textarea />
        <Field label="Intro paragraph" value={inv.intro} onChange={(v) => updateInvestors({ intro: v })} textarea />
        <Field label="Button label" value={inv.ctaLabel} onChange={(v) => updateInvestors({ ctaLabel: v })} />
        <Field
          label="Exchange rate (PHP per 1 USD)"
          type="number"
          value={inv.phpPerUsd}
          onChange={(v) => updateInvestors({ phpPerUsd: parseFloat(v) || 0 })}
        />
      </Block>

      {/* PROJECTS */}
      <Block title={`Projects & developments (${inv.projects.length})`}>
        <Field label="Eyebrow" value={inv.projectsEyebrow} onChange={(v) => updateInvestors({ projectsEyebrow: v })} />
        <Field label="Title" value={inv.projectsTitle} onChange={(v) => updateInvestors({ projectsTitle: v })} />
        <Field label="Body" value={inv.projectsBody} onChange={(v) => updateInvestors({ projectsBody: v })} textarea />

        <div className="space-y-4">
          {inv.projects.map((p: InvestorProject) => (
            <div key={p.id} className={cardCls}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] tracking-[0.2em] uppercase text-gold-300 font-sans">{p.name || "New project"}</span>
                <button className={delBtnCls} onClick={() => removeItem("projects", inv.projects, p.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
              <Field label="Name" value={p.name} onChange={(v) => editItem("projects", inv.projects, p.id, { name: v })} />
              <Field label="Location" value={p.location} onChange={(v) => editItem("projects", inv.projects, p.id, { location: v })} />
              <Field label="Status" value={p.status} onChange={(v) => editItem("projects", inv.projects, p.id, { status: v })} />
              <Field
                label="Description"
                value={p.description}
                onChange={(v) => editItem("projects", inv.projects, p.id, { description: v })}
                textarea
              />
              <div>
                <label className={labelCls}>Image</label>
                {p.imageUrl && <img src={p.imageUrl} alt="" className="w-full h-28 object-cover mb-2 rounded-sm" />}
                <input
                  type="file"
                  accept={acceptImage}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onUpload(f, (url) => editItem("projects", inv.projects, p.id, { imageUrl: url }));
                  }}
                  className="w-full text-xs text-luxury-200"
                />
                <p className="mt-1 text-[9px] tracking-wider text-luxury-500 font-sans uppercase">{imageGuidance}</p>
                <input
                  value={p.imageUrl}
                  onChange={(e) => editItem("projects", inv.projects, p.id, { imageUrl: e.target.value })}
                  placeholder="…or paste an image URL"
                  className={`${inputCls} mt-2`}
                />
              </div>
            </div>
          ))}
          <button
            className={addBtnCls}
            onClick={() =>
              patchList("projects", [
                ...inv.projects,
                { id: uid("prj"), name: "New development", location: "", status: "", description: "", imageUrl: "" },
              ])
            }
          >
            <Plus size={12} /> Add development
          </button>
        </div>
      </Block>

      {/* STATS */}
      <Block title={`Headline stats (${inv.stats.length})`}>
        {inv.stats.map((s: InvestorStat) => (
          <div key={s.id} className={cardCls}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] tracking-[0.2em] uppercase text-gold-300 font-sans">{s.label || "Stat"}</span>
              <button className={delBtnCls} onClick={() => removeItem("stats", inv.stats, s.id)}>
                <Trash2 size={14} />
              </button>
            </div>
            <Field label="Value" value={s.value} onChange={(v) => editItem("stats", inv.stats, s.id, { value: v })} />
            <Field label="Label" value={s.label} onChange={(v) => editItem("stats", inv.stats, s.id, { label: v })} />
          </div>
        ))}
        <button className={addBtnCls} onClick={() => patchList("stats", [...inv.stats, { id: uid("st"), value: "", label: "" }])}>
          <Plus size={12} /> Add stat
        </button>
      </Block>

      {/* UNITS */}
      <Block title={`Unit typologies & prices (${inv.units.length})`}>
        <Field label="Eyebrow" value={inv.unitsEyebrow} onChange={(v) => updateInvestors({ unitsEyebrow: v })} />
        <Field label="Title" value={inv.unitsTitle} onChange={(v) => updateInvestors({ unitsTitle: v })} />
        {inv.units.map((u: InvestorUnit) => (
          <div key={u.id} className={cardCls}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] tracking-[0.2em] uppercase text-gold-300 font-sans">{u.name || "Unit"}</span>
              <button className={delBtnCls} onClick={() => removeItem("units", inv.units, u.id)}>
                <Trash2 size={14} />
              </button>
            </div>
            <Field label="Name" value={u.name} onChange={(v) => editItem("units", inv.units, u.id, { name: v })} />
            <Field label="Code" value={u.code} onChange={(v) => editItem("units", inv.units, u.id, { code: v })} />
            <Field label="Footprint" value={u.footprint} onChange={(v) => editItem("units", inv.units, u.id, { footprint: v })} />
            <Field label="Interior" value={u.interior} onChange={(v) => editItem("units", inv.units, u.id, { interior: v })} />
            <Field label="Guests / rooms" value={u.guests} onChange={(v) => editItem("units", inv.units, u.id, { guests: v })} />
            <Field
              label="Price per unit (USD)"
              type="number"
              value={u.priceUsd}
              onChange={(v) => editItem("units", inv.units, u.id, { priceUsd: parseFloat(v) || 0 })}
            />
            <p className="text-[10px] text-luxury-500 font-sans">
              Shown on the site as ₱{Math.round(u.priceUsd * (inv.phpPerUsd || 0)).toLocaleString("en-US")}
            </p>
            <Field
              label="Quantity note"
              value={u.quantityNote}
              onChange={(v) => editItem("units", inv.units, u.id, { quantityNote: v })}
            />
            <div>
              <label className={labelCls}>Rendering / photo</label>
              {u.imageUrl && <img src={u.imageUrl} alt="" className="w-full h-28 object-cover mb-2 rounded-sm" />}
              <input
                type="file"
                accept={acceptImage}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUpload(f, (url) => editItem("units", inv.units, u.id, { imageUrl: url }));
                }}
                className="w-full text-xs text-luxury-200"
              />
              <p className="mt-1 text-[9px] tracking-wider text-luxury-500 font-sans uppercase">{imageGuidance}</p>
              <input
                value={u.imageUrl}
                onChange={(e) => editItem("units", inv.units, u.id, { imageUrl: e.target.value })}
                placeholder="…or paste an image URL"
                className={`${inputCls} mt-2`}
              />
            </div>
          </div>
        ))}
        <button
          className={addBtnCls}
          onClick={() =>
            patchList("units", [
              ...inv.units,
              {
                id: uid("unit"),
                name: "New unit",
                code: "",
                imageUrl: "",
                footprint: "",
                interior: "",
                guests: "",
                priceUsd: 0,
                quantityNote: "",
              },
            ])
          }
        >
          <Plus size={12} /> Add unit type
        </button>
      </Block>

      {/* BUDGET */}
      <Block title={`Budget injected (${inv.budgetItems.length})`}>
        <Field label="Eyebrow" value={inv.budgetEyebrow} onChange={(v) => updateInvestors({ budgetEyebrow: v })} />
        <Field label="Title" value={inv.budgetTitle} onChange={(v) => updateInvestors({ budgetTitle: v })} />
        <Field label="Footnote" value={inv.budgetNote} onChange={(v) => updateInvestors({ budgetNote: v })} textarea />
        {inv.budgetItems.map((b: InvestorBudgetItem) => (
          <div key={b.id} className={cardCls}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] tracking-[0.2em] uppercase text-gold-300 font-sans">{b.label || "Line item"}</span>
              <button className={delBtnCls} onClick={() => removeItem("budgetItems", inv.budgetItems, b.id)}>
                <Trash2 size={14} />
              </button>
            </div>
            <Field label="Label" value={b.label} onChange={(v) => editItem("budgetItems", inv.budgetItems, b.id, { label: v })} />
            <Field
              label="Allocated (PHP)"
              type="number"
              value={b.allocatedPhp}
              onChange={(v) => editItem("budgetItems", inv.budgetItems, b.id, { allocatedPhp: parseFloat(v) || 0 })}
            />
            <Field
              label="Injected so far (PHP)"
              type="number"
              value={b.injectedPhp}
              onChange={(v) => editItem("budgetItems", inv.budgetItems, b.id, { injectedPhp: parseFloat(v) || 0 })}
            />
            <Field label="Note" value={b.note} onChange={(v) => editItem("budgetItems", inv.budgetItems, b.id, { note: v })} />
          </div>
        ))}
        <button
          className={addBtnCls}
          onClick={() =>
            patchList("budgetItems", [
              ...inv.budgetItems,
              { id: uid("bud"), label: "New line item", allocatedPhp: 0, injectedPhp: 0, note: "" },
            ])
          }
        >
          <Plus size={12} /> Add budget line
        </button>
      </Block>

      {/* CAPITAL */}
      <Block title={`Capital snapshot (${inv.capitalRows.length})`}>
        <Field label="Eyebrow" value={inv.capitalEyebrow} onChange={(v) => updateInvestors({ capitalEyebrow: v })} />
        <Field label="Title" value={inv.capitalTitle} onChange={(v) => updateInvestors({ capitalTitle: v })} />
        <Field
          label="Footnote"
          value={inv.capitalFootnote}
          onChange={(v) => updateInvestors({ capitalFootnote: v })}
          textarea
        />
        {inv.capitalRows.map((r: InvestorCapitalRow) => (
          <div key={r.id} className={cardCls}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] tracking-[0.2em] uppercase text-gold-300 font-sans">{r.label || "Row"}</span>
              <button className={delBtnCls} onClick={() => removeItem("capitalRows", inv.capitalRows, r.id)}>
                <Trash2 size={14} />
              </button>
            </div>
            <Field label="Label" value={r.label} onChange={(v) => editItem("capitalRows", inv.capitalRows, r.id, { label: v })} />
            <Field
              label="Value (leave blank to auto-use the matching unit price)"
              value={r.value}
              onChange={(v) => editItem("capitalRows", inv.capitalRows, r.id, { value: v })}
            />
            <Field label="Note" value={r.note} onChange={(v) => editItem("capitalRows", inv.capitalRows, r.id, { note: v })} />
          </div>
        ))}
        <button
          className={addBtnCls}
          onClick={() => patchList("capitalRows", [...inv.capitalRows, { id: uid("cap"), label: "", value: "", note: "" }])}
        >
          <Plus size={12} /> Add capital row
        </button>
      </Block>

      {/* TIMELINE */}
      <Block title={`Timeline (${inv.timeline.length})`}>
        <Field label="Eyebrow" value={inv.timelineEyebrow} onChange={(v) => updateInvestors({ timelineEyebrow: v })} />
        <Field label="Title" value={inv.timelineTitle} onChange={(v) => updateInvestors({ timelineTitle: v })} />
        {inv.timeline.map((t: InvestorTimelineItem) => (
          <div key={t.id} className={cardCls}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] tracking-[0.2em] uppercase text-gold-300 font-sans">{t.year || "Phase"}</span>
              <button className={delBtnCls} onClick={() => removeItem("timeline", inv.timeline, t.id)}>
                <Trash2 size={14} />
              </button>
            </div>
            <Field label="Year" value={t.year} onChange={(v) => editItem("timeline", inv.timeline, t.id, { year: v })} />
            <Field label="Title" value={t.title} onChange={(v) => editItem("timeline", inv.timeline, t.id, { title: v })} />
            <Field
              label="Bullet points (one per line)"
              value={t.points.join("\n")}
              onChange={(v) =>
                editItem("timeline", inv.timeline, t.id, { points: v.split("\n").filter((x) => x.trim() !== "") })
              }
              textarea
            />
          </div>
        ))}
        <button
          className={addBtnCls}
          onClick={() => patchList("timeline", [...inv.timeline, { id: uid("tl"), year: "", title: "", points: [] }])}
        >
          <Plus size={12} /> Add phase
        </button>
      </Block>

      {/* CIRCLE MODEL */}
      <Block title={`Circle model & benefits (${inv.benefits.length})`}>
        <Field label="Eyebrow" value={inv.circleEyebrow} onChange={(v) => updateInvestors({ circleEyebrow: v })} />
        <Field label="Title" value={inv.circleTitle} onChange={(v) => updateInvestors({ circleTitle: v })} />
        <Field label="Body" value={inv.circleBody} onChange={(v) => updateInvestors({ circleBody: v })} textarea />
        <Field
          label="Primary split label"
          value={inv.circlePrimaryLabel}
          onChange={(v) => updateInvestors({ circlePrimaryLabel: v })}
        />
        <Field
          label="Secondary split label"
          value={inv.circleSecondaryLabel}
          onChange={(v) => updateInvestors({ circleSecondaryLabel: v })}
        />
        {inv.benefits.map((b: InvestorBenefit) => (
          <div key={b.id} className={cardCls}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] tracking-[0.2em] uppercase text-gold-300 font-sans">{b.title || "Benefit"}</span>
              <button className={delBtnCls} onClick={() => removeItem("benefits", inv.benefits, b.id)}>
                <Trash2 size={14} />
              </button>
            </div>
            <Field label="Title" value={b.title} onChange={(v) => editItem("benefits", inv.benefits, b.id, { title: v })} />
            <Field label="Copy" value={b.copy} onChange={(v) => editItem("benefits", inv.benefits, b.id, { copy: v })} textarea />
          </div>
        ))}
        <button
          className={addBtnCls}
          onClick={() => patchList("benefits", [...inv.benefits, { id: uid("bn"), title: "", copy: "" }])}
        >
          <Plus size={12} /> Add benefit
        </button>
      </Block>

      {/* CLOSING */}
      <Block title="Closing call-to-action">
        <Field label="Eyebrow" value={inv.closingEyebrow} onChange={(v) => updateInvestors({ closingEyebrow: v })} />
        <Field label="Title" value={inv.closingTitle} onChange={(v) => updateInvestors({ closingTitle: v })} textarea />
        <Field label="Body" value={inv.closingBody} onChange={(v) => updateInvestors({ closingBody: v })} textarea />
        <Field label="Form title" value={inv.formTitle} onChange={(v) => updateInvestors({ formTitle: v })} />
        <Field label="Legal disclaimer" value={inv.disclaimer} onChange={(v) => updateInvestors({ disclaimer: v })} textarea />
      </Block>

      <button
        onClick={() => {
          if (confirm("Reset the entire investor section to its default content?")) updateInvestors(DEFAULT_INVESTORS);
        }}
        className="text-[10px] tracking-[0.2em] uppercase text-luxury-500 hover:text-red-400 font-sans transition-colors"
      >
        Reset investor section to defaults
      </button>
    </div>
  );
}
