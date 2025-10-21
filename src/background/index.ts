import { ContextMenuController } from './contextMenu';
import { MessageRouter } from './messageRouter';
import { ensureDefaultSettings } from './settings';
import { SitePolicyStore } from './sitePolicyStore';
import { TranslationService } from './translationService';

const sitePolicyStore = new SitePolicyStore();
const translationService = new TranslationService();
const messageRouter = new MessageRouter(sitePolicyStore, translationService);
const contextMenuController = new ContextMenuController();

async function bootstrap() {
  await sitePolicyStore.ensureDefaults();
  await ensureDefaultSettings();
}

bootstrap().catch((error) => console.error('Failed to initialize settings', error));

messageRouter.register();
contextMenuController.register();
