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

  return (
    <div>
      <h1 className={styles.title}>Compare</h1>
      {data.types
        .filter((t) => hasResearch(t.id, data.research))
        .map((t) => (
          <TypeCompare key={t.id} type_={t} data={data} />
        ))}
    </div>
  );
}

function hasResearch(typeId: string, research: Research[]) {
  return research.some((r) => r.type_id === typeId);
}

function TypeCompare({ type_, data }: { type_: SupplementType; data: CompareData }) {
  const products = data.products.filter((p) => p.type_id === type_.id);
  const research = data.research.filter((r) => r.type_id === type_.id);
  const allBrandIds = [...new Set(research.map((r) => r.brand_id))];

  return (
    <section className={shared.card}>
      <h2 className={shared.cardTitle}>
        {type_.name}
        <span className={styles.target}>
          {type_.target_dose} {type_.target_unit}/day
        </span>
      </h2>
      <div className={styles.grid}>
        {allBrandIds.map((brandId) => {
          const res = research.find((r) => r.brand_id === brandId);
          const product = products.find((p) => p.brand_id === brandId);
          return (
            <BrandCell
              key={brandId}
              brandName={res?.brand_name ?? brandId}
              research={res ?? null}
              product={product ?? null}
              targetDose={type_.target_dose}
            />
          );
        })}
      </div>
    </section>
  );
}

function BrandCell({
  brandName,
  research,
  product,
  targetDose,
}: {
  brandName: string;
  research: Research | null;
  product: SupplementBrand | null;
  targetDose: number;
}) {
  if (research?.not_found) {
    return (
      <div className={`${styles.cell} ${styles.dne}`}>
        <span className={styles.cellBrand}>{brandName}</span>
        <span className={styles.cellDne}>DNE</span>
      </div>
    );
  }
  if (!product) {
    return (
      <div className={`${styles.cell} ${styles.noProduct}`}>
        <span className={styles.cellBrand}>{brandName}</span>
        <span className={styles.cellNote}>Researched, no product added</span>
        {research?.notes && <span className={styles.cellNote}>{research.notes}</span>}
      </div>
    );
  }
  return <ProductCell brandName={brandName} product={product} targetDose={targetDose} />;
}

function ProductCell({
  brandName,
  product,
  targetDose,
}: {
  brandName: string;
  product: SupplementBrand;
  targetDose: number;
}) {
  const servingsNeeded = computeServings(targetDose, product.serving_dose);
  const dailyCost = product.price_per_serving
    ? (product.price_per_serving * servingsNeeded).toFixed(2)
    : null;

  return (
    <div className={`${styles.cell} ${product.in_stock ? "" : styles.outOfStock}`}>
      <span className={styles.cellBrand}>{brandName}</span>
      <span className={styles.cellProduct}>{product.product_name}</span>
      <span className={styles.cellDose}>
        {product.serving_dose} {product.serving_unit}/{product.unit_name}
      </span>
      {dailyCost ? (
        <span className={styles.cellPrice}>${dailyCost}/day</span>
      ) : (
        <span className={styles.cellNote}>Price TBD</span>
      )}
      {product.subscription_discount && (
        <span className={styles.cellDiscount}>{product.subscription_discount}% sub</span>
      )}
      {product.url && (
        <a href={product.url} target="_blank" rel="noopener noreferrer" className={styles.cellLink}>
          View
        </a>
      )}
      {!product.in_stock && <span className={styles.cellNote}>Out of stock</span>}
    </div>
  );
}

function computeServings(target: number, perServing: number): number {
  if (perServing <= 0) return 1;
  return Math.ceil(target / perServing);
}
