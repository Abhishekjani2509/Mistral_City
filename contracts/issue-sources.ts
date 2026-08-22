/** Renderer-side metadata kept separate from the frozen CityModel contract. */
export interface IssueSourceLink {
  issueId: string;
  systemId: string;
  file: string;
  line: number;
  url: string;
}
