export interface Token {
  id: number;
  processId: number;
  currentStep: string;
  snapshot?: any;
}
