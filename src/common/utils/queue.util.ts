export class Queue<T> {
  private items: T[];

  constructor() {
    this.items = [];
  }

  push(element: T): void {
    this.items.push(element);
  }

  pop(): T | undefined {
    return this.isEmpty() ? undefined : this.items.shift();
  }

  front(): T | undefined {
    return this.isEmpty() ? undefined : this.items[0];
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  size(): number {
    return this.items.length;
  }
}
