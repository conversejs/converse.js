import { CustomElement } from 'shared/components/element.js';
import { api } from '@converse/headless';
import tplTodo from './templates/todo.js';

class TodoApp extends CustomElement {
    render() {
        return tplTodo();
    }
}

api.elements.define('converse-app-todo', TodoApp);
