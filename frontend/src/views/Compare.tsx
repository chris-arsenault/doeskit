import { useEffect, useState, useCallback } from "react";
import { apiGet, apiPut } from "../data/api";
import type { SupplementType, SupplementBrand } from "../data/store";
import shared from "../styles/shared.module.css";
import styles from "./Compare.module.css";

type Brand = { id: string; name: string };
type Research = {
  type_id: string;
  brand_id: string;
  brand_name: string;
  not_found: boolean;
  notes: string | null;
  last_researched: string;
};
type CompareData = {
  types: SupplementType[];
  brands: Brand[];
  products: SupplementBrand[];
  research: Research[];
};

export default function Compare() {
  const [data, setData] = useState<CompareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<SupplementBrand | null>(null);

  const reload = useCallback(() => {
    apiGet<CompareData>("/compare")
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleSave = useCallback(() => {
    setEditing(null);
    reload();
  }, [reload]);

  if (loading || !data) {
    return (
      <div className={shared.loadingState}>
        <div className={shared.spinner} />
      </div>
    );
  }

  const researchedTypes = data.types.filter((t) => data.research.some((r) => r.type_id === t.id));
  const brandCols = getBrandColumns(data.research);

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Cost Comparison</h1>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.suppCol}>Supplement</th>
              {brandCols.map((b) => (
                <th key={b.id} className={styles.brandCol}>
                  {b.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {researchedTypes.map((t) => (
              <TypeRow key={t.id} type_={t} brandCols={brandCols} data={data} onEdit={setEditing} />
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <EditModal product={editing} onClose={() => setEditing(null)} onSave={handleSave} />
      )}
    </div>
  );
}

function getBrandColumns(research: Research[]): Brand[] {
  const seen = new Map<string, string>();
  for (const r of research) {
    if (!seen.has(r.brand_id)) seen.set(r.brand_id, r.brand_name);
  }
  return [...seen.entries()].map(([id, name]) => ({ id, name }));
}

function TypeRow({
  type_,
  brandCols,
  data,
  onEdit,
}: {
  type_: SupplementType;
  brandCols: Brand[];
  data: CompareData;
  onEdit: (p: SupplementBrand) => void;
}) {
  return (
    <tr>
      <td className={styles.suppCell}>
        <span className={styles.suppName}>{type_.name}</span>
        <span className={styles.suppTarget}>
          {type_.target_dose} {type_.target_unit}
        </span>
      </td>
      {brandCols.map((b) => {
        const res = data.research.find((r) => r.type_id === type_.id && r.brand_id === b.id);
        const product = data.products.find((p) => p.type_id === type_.id && p.brand_id === b.id);
        return (
          <PriceCell
            key={b.id}
            research={res}
            product={product}
            target={type_.target_dose}
            onEdit={onEdit}
          />
        );
      })}
    </tr>
  );
}

function PriceCell({
  research,
  product,
  target,
  onEdit,
}: {
  research: Research | undefined;
  product: SupplementBrand | undefined;
  target: number;
  onEdit: (p: SupplementBrand) => void;
}) {
  if (!research) return <td className={styles.cell} />;
  if (research.not_found) {
    return (
      <td className={`${styles.cell} ${styles.dne}`}>
        <span className={styles.dneLabel}>DNE</span>
      </td>
    );
  }
  if (!product) {
    return (
      <td className={`${styles.cell} ${styles.noData}`}>
        {research.notes ? (
          <span className={styles.researchNote}>{research.notes}</span>
        ) : (
          <span className={styles.noDataLabel}>No product data</span>
        )}
      </td>
    );
  }
  return <ProductCell product={product} target={target} onEdit={onEdit} />;
}

function ProductCell({
  product,
  target,
  onEdit,
}: {
  product: SupplementBrand;
  target: number;
  onEdit: (p: SupplementBrand) => void;
}) {
  const units =
    target > 0 && product.serving_dose > 0 ? Math.ceil(target / product.serving_dose) : 1;
  const daily = product.price_per_serving ? product.price_per_serving * units : null;

  return (
    <td
      className={`${styles.cell} ${styles.clickable} ${!product.in_stock ? styles.outOfStock : ""}`}
      onClick={() => onEdit(product)}
    >
      {daily != null ? (
        <span className={styles.price}>${daily.toFixed(2)}/day</span>
      ) : (
        <span className={styles.noPrice}>+ price</span>
      )}
      <span className={styles.unitsPerDay}>
        {units} {product.unit_name}
        {units > 1 && !product.unit_name.endsWith("s") ? "s" : ""}/day
      </span>
      {product.subscription_discount && (
        <span className={styles.discount}>-{product.subscription_discount}% sub</span>
      )}
      {product.url ? (
        <a
          href={product.url}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.productLink}
          onClick={(e) => e.stopPropagation()}
        >
          {product.product_name}
        </a>
      ) : (
        <span className={styles.productName}>{product.product_name}</span>
      )}
    </td>
  );
}

function buildPayload(f: Record<string, string>) {
  const optStr = (v: string) => v || null;
  const optNum = (v: string) => (v ? parseFloat(v) : null);
  return {
    product_name: optStr(f.product_name),
    serving_dose: optNum(f.serving_dose),
    serving_unit: optStr(f.serving_unit),
    units_per_serving: optNum(f.units_per_serving),
    unit_name: optStr(f.unit_name),
    form: optStr(f.form),
    instructions: optStr(f.instructions),
    url: optStr(f.url),
    price_per_serving: optNum(f.price_per_serving),
    subscription_discount: optNum(f.subscription_discount),
  };
}

function EditModal({
  product,
  onClose,
  onSave,
}: {
  product: SupplementBrand;
  onClose: () => void;
  onSave: () => void;
}) {
  const [f, setF] = useState({
    product_name: product.product_name,
    serving_dose: product.serving_dose.toString(),
    serving_unit: product.serving_unit,
    units_per_serving: product.units_per_serving.toString(),
    unit_name: product.unit_name,
    form: product.form,
    instructions: product.instructions ?? "",
    url: product.url ?? "",
    price_per_serving: product.price_per_serving?.toString() ?? "",
    subscription_discount: product.subscription_discount?.toString() ?? "",
  });

  const set = (k: string, v: string) => setF((prev) => ({ ...prev, [k]: v }));

  const save = async () => {
    await apiPut(`/brands/${product.id}/pricing`, buildPayload(f));
    onSave();
  };

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div className={styles.overlay} onClick={onClose}>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.modalTitle}>
          {product.brand_name} — {product.product_name}
        </h3>
        <ModalForm f={f} set={set} />
        <div className={styles.modalActions}>
          <button className={styles.saveBtn} onClick={save}>
            Save
          </button>
          <button className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

type FormProps = { f: Record<string, string>; set: (k: string, v: string) => void };

function ModalForm({ f, set }: FormProps) {
  return (
    <div className={styles.modalGrid}>
      <ProductFields f={f} set={set} />
      <PricingFields f={f} set={set} />
    </div>
  );
}

function ProductFields({ f, set }: FormProps) {
  return (
    <>
      <label htmlFor="ed-name">Product</label>
      <input
        id="ed-name"
        value={f.product_name}
        onChange={(e) => set("product_name", e.target.value)}
      />
      <label htmlFor="ed-dose">Dose/unit</label>
      <div className={styles.modalRow}>
        <input
          id="ed-dose"
          type="number"
          step="0.01"
          value={f.serving_dose}
          onChange={(e) => set("serving_dose", e.target.value)}
          placeholder="dose"
        />
        <input
          id="ed-unit"
          value={f.serving_unit}
          onChange={(e) => set("serving_unit", e.target.value)}
          placeholder="mg, IU..."
        />
      </div>
      <label htmlFor="ed-ups">Units/srv</label>
      <div className={styles.modalRow}>
        <input
          id="ed-ups"
          type="number"
          step="1"
          value={f.units_per_serving}
          onChange={(e) => set("units_per_serving", e.target.value)}
          placeholder="#"
        />
        <input
          id="ed-uname"
          value={f.unit_name}
          onChange={(e) => set("unit_name", e.target.value)}
          placeholder="capsule..."
        />
      </div>
      <label htmlFor="ed-form">Form</label>
      <select id="ed-form" value={f.form} onChange={(e) => set("form", e.target.value)}>
        <option value="pill">pill</option>
        <option value="scoop">scoop</option>
        <option value="drops">drops</option>
      </select>
    </>
  );
}

function PricingFields({ f, set }: FormProps) {
  return (
    <>
      <label htmlFor="ed-price">$/unit</label>
      <input
        id="ed-price"
        type="number"
        step="0.001"
        value={f.price_per_serving}
        onChange={(e) => set("price_per_serving", e.target.value)}
      />
      <label htmlFor="ed-disc">Sub %</label>
      <input
        id="ed-disc"
        type="number"
        step="1"
        value={f.subscription_discount}
        onChange={(e) => set("subscription_discount", e.target.value)}
      />
      <label htmlFor="ed-url">URL</label>
      <input id="ed-url" type="url" value={f.url} onChange={(e) => set("url", e.target.value)} />
      <label htmlFor="ed-notes">Notes</label>
      <input
        id="ed-notes"
        value={f.instructions}
        onChange={(e) => set("instructions", e.target.value)}
      />
    </>
  );
}
