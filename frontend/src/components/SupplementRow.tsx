import { memo, useState } from "react";
import { useStore, type DailyDose, type SupplementBrand } from "../data/store";
import { Check, ChevronDown } from "lucide-react";
import styles from "./SupplementRow.module.css";

type Props = {
  dose: DailyDose;
  altBrands: SupplementBrand[];
};

const SupplementRow = memo(function SupplementRow({ dose, altBrands }: Props) {
  const typeId = dose.supplement_type.id;
  const taken = useStore((s) => s.taken[typeId] ?? false);
  const toggle = useStore((s) => s.toggleSupplement);
  const [overrideBrand, setOverrideBrand] = useState<SupplementBrand | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const activeBrand = overrideBrand ?? dose.brand;
  const hasAlts = altBrands.length > 1;

  return (
    <li className={styles.item}>
      <button
        className={`${styles.checkBtn} ${taken ? styles.checked : ""}`}
        onClick={() => toggle(typeId, activeBrand.id)}
      >
        {taken && <Check size={16} />}
      </button>
      <div className={styles.info}>
        <span className={styles.name}>{dose.supplement_type.name}</span>
        {hasAlts ? (
          <BrandPicker
            brands={altBrands}
            active={activeBrand}
            open={showPicker}
            onToggle={() => setShowPicker(!showPicker)}
            onSelect={(b) => {
              setOverrideBrand(b);
              setShowPicker(false);
            }}
            doseLabel={dose.dose_label}
          />
        ) : (
          <span className={styles.dose}>
            {dose.dose_label} &middot; {activeBrand.brand_name}
          </span>
        )}
        {(dose.supplement_type.instructions || activeBrand.instructions) && (
          <span className={styles.notes}>
            {dose.supplement_type.instructions}
            {dose.supplement_type.instructions && activeBrand.instructions && " — "}
            {activeBrand.instructions}
          </span>
        )}
      </div>
    </li>
  );
});

function BrandPicker({
  brands,
  active,
  open,
  onToggle,
  onSelect,
  doseLabel,
}: {
  brands: SupplementBrand[];
  active: SupplementBrand;
  open: boolean;
  onToggle: () => void;
  onSelect: (b: SupplementBrand) => void;
  doseLabel: string;
}) {
  return (
    <div className={styles.brandPicker}>
      <button className={styles.brandToggle} onClick={onToggle}>
        <span className={styles.dose}>
          {doseLabel} &middot; {active.brand_name}
        </span>
        <ChevronDown size={12} className={styles.chevron} />
      </button>
      {open && (
        <div className={styles.brandDropdown}>
          {brands.map((b) => (
            <button
              key={b.id}
              className={`${styles.brandOption} ${b.id === active.id ? styles.brandSelected : ""}`}
              onClick={() => onSelect(b)}
            >
              {b.brand_name} {b.product_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default SupplementRow;
