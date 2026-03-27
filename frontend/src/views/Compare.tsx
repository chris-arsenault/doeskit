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

  const reload = useCallback(() => {
    apiGet<CompareData>("/compare")
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
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
              <TypeRow key={t.id} type_={t} brandCols={brandCols} data={data} onUpdate={reload} />
            ))}
          </tbody>
        </table>
      </div>
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
  onUpdate,
}: {
  type_: SupplementType;
  brandCols: Brand[];
  data: CompareData;
  onUpdate: () => void;
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
            onUpdate={onUpdate}
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
  onUpdate,
}: {
  research: Research | undefined;
  product: SupplementBrand | undefined;
  target: number;
  onUpdate: () => void;
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
  return <ProductPriceCell product={product} target={target} onUpdate={onUpdate} />;
}

function ProductPriceCell({
  product,
  target,
  onUpdate,
}: {
  product: SupplementBrand;
  target: number;
  onUpdate: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const handleDone = useCallback(() => {
    setEditing(false);
    onUpdate();
  }, [onUpdate]);

  return (
    <td className={`${styles.cell} ${!product.in_stock ? styles.outOfStock : ""}`}>
      {editing ? (
        <PriceEditor product={product} onDone={handleDone} />
      ) : (
        <PriceDisplay product={product} target={target} onEdit={() => setEditing(true)} />
      )}
    </td>
  );
}

function PriceDisplay({
  product,
  target,
  onEdit,
}: {
  product: SupplementBrand;
  target: number;
  onEdit: () => void;
}) {
  const unitsPerDay =
    target > 0 && product.serving_dose > 0 ? Math.ceil(target / product.serving_dose) : 1;
  const dailyCost = product.price_per_serving ? product.price_per_serving * unitsPerDay : null;

  return (
    <>
      <button className={styles.priceBtn} onClick={onEdit}>
        {dailyCost != null ? (
          <span className={styles.price}>${dailyCost.toFixed(2)}/day</span>
        ) : (
          <span className={styles.noPrice}>+ price</span>
        )}
      </button>
      <span className={styles.unitsPerDay}>
        {unitsPerDay} {product.unit_name}
        {unitsPerDay > 1 && !product.unit_name.endsWith("s") ? "s" : ""}/day
      </span>
      {product.subscription_discount && (
        <span className={styles.discount}>-{product.subscription_discount}% sub</span>
      )}
      <ProductLink product={product} />
    </>
  );
}

function ProductLink({ product }: { product: SupplementBrand }) {
  if (product.url) {
    return (
      <a
        href={product.url}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.productLink}
      >
        {product.product_name}
      </a>
    );
  }
  return <span className={styles.productName}>{product.product_name}</span>;
}

function PriceEditor({ product, onDone }: { product: SupplementBrand; onDone: () => void }) {
  const [price, setPrice] = useState(product.price_per_serving?.toString() ?? "");
  const [discount, setDiscount] = useState(product.subscription_discount?.toString() ?? "");
  const [url, setUrl] = useState(product.url ?? "");

  const save = async () => {
    await apiPut(`/brands/${product.id}/pricing`, {
      price_per_serving: price ? parseFloat(price) : null,
      subscription_discount: discount ? parseFloat(discount) : null,
      url: url || null,
    });
    onDone();
  };

  return (
    <div className={styles.editor}>
      <input
        className={styles.editorInput}
        type="number"
        step="0.01"
        placeholder="$/unit"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
      />
      <input
        className={styles.editorInput}
        type="number"
        step="1"
        placeholder="Sub %"
        value={discount}
        onChange={(e) => setDiscount(e.target.value)}
      />
      <input
        className={styles.editorInput}
        type="url"
        placeholder="URL"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <div className={styles.editorActions}>
        <button className={styles.editorSave} onClick={save}>
          Save
        </button>
        <button className={styles.editorCancel} onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  );
}
