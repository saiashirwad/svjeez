import { show } from "./show";

export default show(
  "Sankey diagram",
  `sankey-beta

Solar,Grid,30
Wind,Grid,25
Gas,Grid,45
Grid,Homes,50
Grid,Industry,35
Grid,Losses,15
Homes,Heating,28
Homes,Lighting,22
Industry,Motors,25
Industry,Heat,10`,
);
