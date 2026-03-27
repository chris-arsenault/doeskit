import { useEffect, useState } from "react";
import { apiGet } from "../data/api";
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

  useEffect(() => {
    apiGet<CompareData>("/compare")
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className={shared.loadingState}>
        <div className={shared.spinner} />
      </div>
    );
  }
  if (!data) return null;

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
              <TypeRow key={t.id} type_={t} brandCols={brandCols} data={data} />
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
}: {
  type_: SupplementType;
  brandCols: Brand[];
  data: CompareData;
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
        return <PriceCell key={b.id} research={res} product={product} target={type_.target_dose} />;
      })}
    </tr>
  );
}

function PriceCell({
  research,
  product,
  target,
}: {
  research: Research | undefined;
  product: SupplementBrand | undefined;
  target: number;
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
        <span className={styles.noDataLabel}>—</span>
      </td>
    );
  }

  return <ProductPriceCell product={product} target={target} />;
}

function ProductPriceCell({ product, target }: { product: SupplementBrand; target: number }) {
  const servings =
    target > 0 && product.serving_dose > 0 ? Math.ceil(target / product.serving_dose) : 1;
  const daily = product.price_per_serving ? product.price_per_serving * servings : null;

  return (
    <td className={`${styles.cell} ${!product.in_stock ? styles.outOfStock : ""}`}>
      {daily != null ? (
        <span className={styles.price}>${daily.toFixed(2)}</span>
      ) : (
        <span className={styles.noPrice}>—</span>
      )}
      {product.subscription_discount && (
        <span className={styles.discount}>{product.subscription_discount}%</span>
      )}
      {product.url ? (
        <a
          href={product.url}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.productLink}
        >
          {product.product_name}
        </a>
      ) : (
        <span className={styles.productName}>{product.product_name}</span>
      )}
    </td>
  );
}
