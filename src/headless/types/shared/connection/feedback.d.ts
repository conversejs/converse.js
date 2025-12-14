export default Feedback;
declare class Feedback extends Model<import("@converse/skeletor").ModelAttributes> {
    constructor(attributes?: Partial<import("@converse/skeletor").ModelAttributes>, options?: import("@converse/skeletor").ModelOptions);
    defaults(): {
        connection_status: number;
        message: string;
    };
    initialize(): void;
}
import { Model } from '@converse/skeletor';
//# sourceMappingURL=feedback.d.ts.map