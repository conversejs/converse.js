export default Feedback;
declare class Feedback extends Model {
    defaults(): {
        connection_status: number;
        message: string;
    };
    initialize(): void;
}
import { Model } from '@converse/skeletor';
//# sourceMappingURL=feedback.d.ts.map