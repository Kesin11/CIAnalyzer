export type Artifact = {
  path: string;
  data: ArrayBuffer;
};

export type CustomReportArtifact = Map<string, Artifact[]>;
