import { MouseSensor, TouchSensor, type MouseSensorOptions, type TouchSensorOptions } from '@dnd-kit/core';
import type { MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from 'react';

function eventTargetElement(target: EventTarget | null): HTMLElement | null {
  return target instanceof HTMLElement ? target : null;
}

export function blurActiveDragHandle() {
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement && activeElement.matches('[data-task-drag-handle="true"]')) {
    activeElement.blur();
  }
}

export class TaskMouseSensor extends MouseSensor {
  static activators = [{
    eventName: 'onMouseDown' as const,
    handler: (event: ReactMouseEvent, options: MouseSensorOptions) => {
      const target = eventTargetElement(event.nativeEvent.target);
      if (!target?.closest('[data-task-drag-handle="true"]')) return false;
      return MouseSensor.activators[0].handler(event, options);
    },
  }];
}

export class TaskTouchSensor extends TouchSensor {
  static activators = [{
    eventName: 'onTouchStart' as const,
    handler: (event: ReactTouchEvent, options: TouchSensorOptions) => {
      const target = eventTargetElement(event.nativeEvent.target);
      if (!target?.closest('[data-task-moving="true"]')) return false;
      return TouchSensor.activators[0].handler(event, options);
    },
  }];
}
