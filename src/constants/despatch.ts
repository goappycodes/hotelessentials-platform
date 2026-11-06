// Despatches sent to the server at a time on import. Each one locks its order and checks
// stock, so batches stay small.
export const DESPATCH_IMPORT_BATCH_SIZE = 25
