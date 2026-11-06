import { useId } from "react";
import { Icon } from "@/components/Icon";
import { Tags } from "@/components/Tags";
import { Count } from "@/components/Count";

export interface NameGroupData {
  key: string;
  title: string;
  description: string;
  names: string[];
}

/** A headed group with its count and plain description; the names stay closed until asked for. */
function NameGroup({ title, description, names }: Omit<NameGroupData, "key">) {
  const headingId = useId();
  return (
    <section className="group" aria-labelledby={headingId}>
      <h2 id={headingId}>{title}<Count n={names.length} className="n" /></h2>
      <p className="sub">{description}</p>
      <details>
        <summary><Icon name="chev" size="sm" className="chev" />Show names<span className="vh"> for {title}</span></summary>
        <Tags label={`${title} names`} items={names} />
      </details>
    </section>
  );
}

export function NameGroups({ groups }: { groups: NameGroupData[] }) {
  const shown = groups.filter(group => group.names.length > 0);
  if (shown.length === 0) return null;
  return <div className="groups">{shown.map(({ key, ...group }) => <NameGroup key={key} {...group} />)}</div>;
}
