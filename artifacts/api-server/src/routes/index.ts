import { Router, type IRouter } from "express";
import savedPlacesRouter from "./saved-places";
import tripsRouter from "./trips";
import itineraryRouter from "./itinerary";
import budgetRouter from "./budget";
import tagsRouter from "./tags";
import sharesRouter from "./shares";
import resolveMapsLinkRouter from "./resolve-maps-link";
import transportModesRouter from "./transport-modes";
import aiChatRouter from "./ai-chat";

const router: IRouter = Router();

router.use(tagsRouter);
router.use(transportModesRouter);
router.use(savedPlacesRouter);
router.use(tripsRouter);
router.use(itineraryRouter);
router.use(budgetRouter);
router.use(sharesRouter);
router.use(resolveMapsLinkRouter);
router.use(aiChatRouter);

export default router;
