import { Collection } from '@converse/skeletor';
import Project from './project';

export default class Projects extends Collection {

    constructor() {
        super();
        this.model = Project;
    }

}
