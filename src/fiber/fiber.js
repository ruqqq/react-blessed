/* @flow */
import type { HostConfig, Reconciler } from 'react-fiber-types';

const {
  debounce
} = require('lodash');
const blessed = require('blessed');
const ReactFiberReconciler : (
  hostConfig: HostConfig<*, *, *, *, *, *, *, *>
) => Reconciler<*, *, *> = require('react-reconciler');

const injectIntoDevToolsConfig = require('./devtools');
const eventListener = require('./events');
const update = require('../shared/update').default;
const solveClass = require('../shared/solveClass').default;
/*
const {
  injectInternals
} = require('react-dom/lib/ReactFiberDevToolsHook');
*/

const emptyObject = {};

type Instance = {
  type: string,
  props: Object,
  _eventListener: Function,
  _updating: boolean,
  screen: typeof blessed.Screen,
};

const BlessedReconciler = ReactFiberReconciler({
  getRootHostContext(rootContainerInstance : Container) : HostContext {
    return emptyObject;
  },
  getChildHostContext(parentHostContext : HostContext, type: string) : HostContext {
    return emptyObject;
  },
  getPublicInstance(instance) {
    return instance;
  },

  createInstance(
    type : string,
    props : Props,
    rootContainerInstance : Container,
    hostContext : HostContext,
    internalInstanceHandle : Object
  ) {
    const {children, ...appliedProps} = solveClass(props);
    const instance = blessed[type](appliedProps);
    instance.props = props;
    instance._eventListener = (...args) => eventListener(instance, ...args);
    instance.on('event', instance._eventListener);

    return instance;
  },

  appendInitialChild(
    parentInstance : Instance,
    child : Instance | TextInstance
  ) : void {
    parentInstance.append(child);
  },

  finalizeInitialChildren(
    instance : Instance,
    type : string,
    props : Props,
    rootContainerInstance : Container
  ) : boolean {
    const {children, ...appliedProps} = solveClass(props);
    update(instance, appliedProps);
    instance.props = props;
    return false;
  },

  prepareUpdate(
    instance : Instance,
    type : string,
    oldProps : Props,
    newProps : Props,
    rootContainerInstance : Container,
    hostContext : HostContext
  ) : null | Array<mixed> {
    return solveClass(newProps);
  },

  shouldSetTextContent(props : Props) : boolean {
    return false;
  },

  shouldDeprioritizeSubtree(type: string, props: Props): boolean {
    return !!props.hidden;
  },

  now: Date.now,

  createTextInstance(
    text : string,
    rootContainerInstance : Container,
    hostContext : HostContext,
    internalInstanceHandle : OpaqueHandle
  ) : TextInstance {
    return blessed.text({content: text});
  },

  scheduleDeferredCallback(a) {
    throw new Error('Unimplemented');
  },

  prepareForCommit() {
    // noop
  },

  resetAfterCommit() {
    // noop
  },

  mutation: {
    commitMount(
      instance : Instance,
      type : string,
      newProps : Props,
      internalInstanceHandle : Object
    ) {
      throw new Error('commitMount not implemented. Please post a reproducible use case that calls this method at https://github.com/Yomguithereal/react-blessed/issues/new');
      instance.screen.debouncedRender();
      // noop
    },

    commitUpdate(
      instance : Instance,
      updatePayload : Array<mixed>,
      type : string,
      oldProps : Props,
      newProps : Props,
      internalInstanceHandle : Object,
    ) : void {
      instance._updating = true;
      update(instance, updatePayload);
      // update event handler pointers
      instance.props = newProps;
      instance._updating = false;
      instance.screen.debouncedRender();
    },

    commitTextUpdate(
      textInstance : TextInstance,
      oldText : string,
      newText : string
    ) : void {
      textInstance.setContent(newText);
      textInstance.screen.debouncedRender();
    },

    appendChild(
      parentInstance : Instance | Container,
      child : Instance | TextInstance
    ) : void {
      parentInstance.append(child);
    },

    appendChildToContainer(
      parentInstance : Instance | Container,
      child : Instance | TextInstance
    ) : void {
      parentInstance.append(child);
    },

    insertBefore(
      parentInstance : Instance | Container,
      child : Instance | TextInstance,
      beforeChild : Instance | TextInstance
    ) : void {
      // pretty sure everything is absolutely positioned so insertBefore ~= append
      parentInstance.append(child);
    },

    insertInContainerBefore(
      parentInstance : Instance | Container,
      child : Instance | TextInstance,
      beforeChild : Instance | TextInstance
    ) : void {
      // pretty sure everything is absolutely positioned so insertBefore ~= append
      parentInstance.append(child);
    },

    removeChild(
      parentInstance : Instance | Container,
      child : Instance | TextInstance
    ) : void {
      parentInstance.remove(child);
      child.off('event', child._eventListener);
      child.destroy();
    },

    removeChildFromContainer(
      parentInstance : Instance | Container,
      child : Instance | TextInstance
    ) : void {
      parentInstance.remove(child);
      child.off('event', child._eventListener);
      child.destroy();
    },

    resetTextContent(instance : Instance) : void {
      instance.setContent('');
    },
  },

  useSyncScheduling: true,
});

BlessedReconciler.injectIntoDevTools(injectIntoDevToolsConfig);

module.exports = {
  render(element, screen, callback) {
    let root = roots.get(screen);
    if (!root) {
      root = BlessedReconciler.createContainer(screen);
      roots.set(screen, root);
    }

    // render at most every 16ms. Should sync this with the screen refresh rate
    // probably if possible
    screen.debouncedRender = debounce(() => screen.render(), 16);
    BlessedReconciler.updateContainer((element : any), root, null, callback);
    screen.debouncedRender();
    return BlessedReconciler.getPublicRootInstance(root);
  }
};

const roots = new Map();