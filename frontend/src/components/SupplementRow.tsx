import { memo } from "react";
import { useStore, type DailyDose } from "../data/store";
import { Check } from "lucide-react";
import styles from "./SupplementRow.module.css";

type Props = {
  dose: DailyDose;
};

const SupplementRow = memo(function SupplementRow({ dose }: Props) {
  const typeId = dose.supplement_type.id;
  const taken = useStore((s) => s.taken[typeId] ?? false);
  const toggle = useStore((s) => s.toggleSupplement);

  return (
    <li className={styles.item}>
      <button
        className={`${styles.checkBtn} ${taken ? styles.checked : ""}`}
        onClick={() => toggle(typeId)}
      >
        {taken && <Check size={16} />}
      </button>
      <div className={styles.info}>
        <span className={styles.name}>{dose.supplement_type.name}</span>
        <span className={styles.dose}>
          {dose.dose_label} &middot; {dose.brand.brand} {dose.brand.product_name}
        </span>
        {(dose.supplement_type.instructions || dose.brand.instructions) && (
          <span className={styles.notes}>
            {dose.supplement_type.instructions}
            {dose.supplement_type.instructions && dose.brand.instructions && " — "}
            {dose.brand.instructions}
          </span>
        )}
      </div>
    </li>
  );
});

export default SupplementRow;
