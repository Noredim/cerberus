export interface OfflineAction {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
  endpoint: string;
  method: 'POST' | 'PUT' | 'DELETE';
}

const QUEUE_STORAGE_KEY = '@Cerberus:offline_queue';

/**
 * Service to manage offline actions queue (stubbed for future synchronization).
 * (P7 & Ajuste 02/03)
 */
export const OfflineQueueService = {
  /**
   * Adds an action to the offline queue.
   */
  async enqueue(action: Omit<OfflineAction, 'id' | 'timestamp'>): Promise<OfflineAction> {
    const queue = await this.getQueue();
    const newAction: OfflineAction = {
      ...action,
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
      timestamp: Date.now()
    };
    
    queue.push(newAction);
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
    console.log(`[OfflineQueueService] Action queued: ${newAction.type}`, newAction);
    return newAction;
  },

  /**
   * Retrieves the current list of queued offline actions.
   */
  async getQueue(): Promise<OfflineAction[]> {
    const rawQueue = localStorage.getItem(QUEUE_STORAGE_KEY);
    if (!rawQueue) return [];
    try {
      return JSON.parse(rawQueue) as OfflineAction[];
    } catch (e) {
      console.error('[OfflineQueueService] Failed to parse queue:', e);
      return [];
    }
  },

  /**
   * Removes a specific action from the queue by ID.
   */
  async dequeue(actionId: string): Promise<void> {
    const queue = await this.getQueue();
    const filteredQueue = queue.filter(action => action.id !== actionId);
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(filteredQueue));
    console.log(`[OfflineQueueService] Action dequeued: ${actionId}`);
  },

  /**
   * Clears the entire offline queue.
   */
  async clearQueue(): Promise<void> {
    localStorage.removeItem(QUEUE_STORAGE_KEY);
    console.log('[OfflineQueueService] Queue cleared.');
  },

  /**
   * Synchronizes the pending actions with the server.
   * Currently non-operational (stubbed for future implementation).
   */
  async syncPending(): Promise<void> {
    const queue = await this.getQueue();
    if (queue.length === 0) {
      console.log('[OfflineQueueService] No actions to synchronize.');
      return;
    }
    
    console.warn(
      `[OfflineQueueService] Sync requested for ${queue.length} actions. Sincronização offline desabilitada nesta versão.`
    );
    // Future implementation will process actions sequentially when connection returns
  }
};
