import { NotFoundError } from '../../lib/httpErrors.js';
import {
  createPracticeSet,
  getPracticeSets,
  getPracticeSetById,
  answerPracticeQuestion,
} from './service.js';

/**
 * Controller for Resident Targeted Practice Endpoints
 */
export function createPracticeController() {
  return {
    async createPracticeSet(req, res) {
      const size = req.valid?.body?.size;
      const practiceSet = await createPracticeSet({
        userId: req.user._id,
        size,
      });
      res.status(201).json({ data: practiceSet });
    },

    async getPracticeSets(req, res) {
      const { page, pageSize } = req.valid?.query || { page: 1, pageSize: 10 };
      const result = await getPracticeSets({
        userId: req.user._id,
        page,
        pageSize,
      });
      res.status(200).json({ data: result.items, meta: result.meta });
    },

    async getPracticeSetById(req, res) {
      const practiceSet = await getPracticeSetById({
        userId: req.user._id,
        setId: req.params.id,
      });
      res.status(200).json({ data: practiceSet });
    },

    async answerPracticeQuestion(req, res) {
      const questionNo = Number.parseInt(req.params.no, 10);
      if (Number.isNaN(questionNo) || questionNo < 1) {
        throw new NotFoundError('Question not found');
      }

      const { selectedIndex, timeMs } = req.valid.body;
      const result = await answerPracticeQuestion({
        userId: req.user._id,
        setId: req.params.id,
        questionNo,
        selectedIndex,
        timeMs,
      });
      res.status(200).json({ data: result });
    },
  };
}
