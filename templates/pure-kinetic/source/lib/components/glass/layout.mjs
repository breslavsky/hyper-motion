// A 7% layout inset leaves room for the final camera push and orbit in 9:16.
// Content insets and type are measured inside that surface.
export function portraitGlassWidth({W,H,plan}){
  if(W*16!==H*9)return null;
  const inset=Math.max(.07,plan.safe?.left??0,plan.safe?.right??0);
  return W*(1-2*inset);
}
// Every expanded Glass panel is this wide, whatever it holds.
export function glassPanelWidth(K){
  return portraitGlassWidth(K)??Math.min(K.safe.w*.9,1280*K.S);
}
