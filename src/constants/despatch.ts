// Despatches sent to the server at a time on import. Each one locks its order and checks
// stock, so batches stay small.
export const DESPATCH_IMPORT_BATCH_SIZE = 25

// The "?" help on the despatch form and the Transport Details dialog.
export const DESPATCH_HINTS = {
  salesOrder: "Confirmed orders with something left to send.",
  date: "The day the goods leave. Printed on the Despatch Note.",
  transporter: "The courier or transport company carrying the goods.",
  trackingNumber: "The LR, docket or courier number, to follow the shipment. You can add it later.",
  vehicleNumber: "The vehicle carrying the goods, such as WB02AB1234.",
  notes: "Printed on the Despatch Note.",
  packedSent: "Already on a despatch for this order, packed or sent.",
  inStock: "Current stock. A dash means the item doesn't track inventory.",
  boxNumber: "The box this item goes in. Any number or name, such as 1 or A1.",
  boxQuantity: "How many of this item go in this box. Clear it to send the item later.",
  addBox: "Split this item across another box",
  removeBox: "Remove this box",
  savePacked: "The goods are set aside. Stock doesn't change yet.",
  saveDespatched: "The goods have left. Stock goes down now.",
}
