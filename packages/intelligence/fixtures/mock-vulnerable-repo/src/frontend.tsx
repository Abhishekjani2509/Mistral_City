import "./auth";

export function VulnerableProfile(): JSX.Element {
  return <main dangerouslySetInnerHTML={{ __html: localStorage.getItem("profile") ?? "" }} />;
}
