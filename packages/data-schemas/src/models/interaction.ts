import type { IInteraction } from '~/types/interaction';
import { applyTenantIsolation } from '~/models/plugins/tenantIsolation';
import interactionSchema from '~/schema/interaction';

export function createInteractionModel(mongoose: typeof import('mongoose')) {
  applyTenantIsolation(interactionSchema);
  return (
    mongoose.models.Interaction || mongoose.model<IInteraction>('Interaction', interactionSchema)
  );
}
