import { eventBus } from "../core/EventBus.js";
import { SimulatorEngine } from "../simulator/SimulatorEngine.js";
import { Renderer } from "./Renderer.js";
import { EventHandler } from "./EventHandler.js";
import { SidebarElement } from "./SidebarElement.js";
import { Ball, Item, Collidable, RigidBody } from "../simulator/Items.js";
import { createVector } from "../simulator/Vector.js";

export class UIHandler {
  canvas: HTMLCanvasElement;
  engine: SimulatorEngine;
  renderer: Renderer;
  eventHandler: EventHandler;
  playing: boolean;
  engineRepetitions: number;
  queuedRepetitions: number;

  // UI Elements
  private speedInput: HTMLInputElement;
  private playPauseButton: HTMLButtonElement;
  private itemsDiv: HTMLDivElement;
  private selectedObjectContent: HTMLDivElement;
  private sidebarElements: Array<SidebarElement> = [];
  
  // Inputs for creating a new item
  private newItemPosXInput: HTMLInputElement;
  private newItemPosYInput: HTMLInputElement;
  private newItemVelXInput: HTMLInputElement;
  private newItemVelYInput: HTMLInputElement;
  private newItemMassInput: HTMLInputElement;
  private newItemRadiusInput: HTMLInputElement;
  private newItemColorInput: HTMLInputElement;

  // State
  private selectedItemIndex: number | null = null;
  private selectedObjectInputs: { [key: string]: HTMLInputElement } = {};


  constructor(canvas: HTMLCanvasElement, engine: SimulatorEngine, renderer: Renderer, eventHandler: EventHandler) {
    this.canvas = canvas;
    this.engine = engine;
    this.renderer = renderer;
    this.eventHandler = eventHandler;
    this.playing = true;
    this.engineRepetitions = 1.00;
    this.queuedRepetitions = 1.00;

    // --- Select UI elements from the DOM ---
    this.speedInput = document.getElementById("speedInput")! as HTMLInputElement;
    this.playPauseButton = document.getElementById("playpause")! as HTMLButtonElement;
    this.itemsDiv = document.getElementById("itemsDiv")! as HTMLDivElement;
    this.selectedObjectContent = document.getElementById("selectedObjectContent")! as HTMLDivElement;

    // --- Select new item form elements from the DOM ---
    this.newItemPosXInput = document.getElementById("newItemPosX")! as HTMLInputElement;
    this.newItemPosYInput = document.getElementById("newItemPosY")! as HTMLInputElement;
    this.newItemVelXInput = document.getElementById("newItemVelX")! as HTMLInputElement;
    this.newItemVelYInput = document.getElementById("newItemVelY")! as HTMLInputElement;
    this.newItemMassInput = document.getElementById("newItemMass")! as HTMLInputElement;
    this.newItemRadiusInput = document.getElementById("newItemRadius")! as HTMLInputElement;
    this.newItemColorInput = document.getElementById("newItemColor")! as HTMLInputElement;
    
    // Setup listeners for the interactive elements
    this.setupUIListeners();
    this.createInitialSidebarElements();
    this.setupEventListeners();
  }

  private setupUIListeners(): void {
    // --- Simulation Controls ---
    this.speedInput.addEventListener("change", this.textFieldChange);
    this.playPauseButton.addEventListener("click", this.togglePlay);

    // --- New Item Button ---
    const addItemButton = document.getElementById("addItemButton")! as HTMLButtonElement;
    addItemButton.addEventListener("click", this.addItem);

    // --- Global Physics Controls ---
    const gravityCheckbox = document.getElementById("gravity")! as HTMLInputElement;
    gravityCheckbox.checked = this.engine.gravity;
    gravityCheckbox.onchange = () => eventBus.dispatch('gravityToggled', gravityCheckbox.checked);
    
    const attractionCheckbox = document.getElementById("attraction")! as HTMLInputElement;
    attractionCheckbox.checked = this.engine.attraction;
    attractionCheckbox.onchange = () => eventBus.dispatch('attractionToggled', attractionCheckbox.checked);

    // --- Collapsible Section Indicators ---
    const detailsElements = document.querySelectorAll<HTMLDetailsElement>('.sidebar-section details');
    detailsElements.forEach(details => {
        const indicator = details.querySelector<HTMLElement>('.collapse-indicator');
        if (indicator) {
            // Set initial state from HTML 'open' attribute
            indicator.textContent = details.open ? '▲' : '▼';
            // Add listener to toggle indicator on state change
            details.addEventListener('toggle', () => {
                indicator.textContent = details.open ? '▲' : '▼';
            });
        }
    });
  }

  private createInitialSidebarElements(): void {
    for (const item of this.engine.getItems()) {
        const index = this.engine.getItems().indexOf(item);
        this.sidebarElements.push(new SidebarElement(this.itemsDiv, index, this.engine, this));
    }
  }

  private setupEventListeners(): void {
    eventBus.on('itemAdded', (data: { item: any; index: number }) => {
      this.sidebarElements.push(new SidebarElement(this.itemsDiv, data.index, this.engine, this));
    });

    eventBus.on('removeItem', (index: number) => {
        if (this.selectedItemIndex === index) {
            this.selectedItemIndex = null;
            this.renderSelectedObject();
        }
    });

    eventBus.on('itemSelected', (data: { index: number }) => {
        this.selectedItemIndex = data.index;
        this.renderSelectedObject();
        const detailsElement = this.selectedObjectContent.closest('details');
        if (detailsElement) detailsElement.open = true;
    });

    eventBus.on('itemDeselected', () => {
        this.selectedItemIndex = null;
        this.renderSelectedObject();
    });
  }

  private renderSelectedObject(): void {
      this.selectedObjectContent.innerHTML = '';
      this.selectedObjectInputs = {};

      if (this.selectedItemIndex === null) {
          const p = document.createElement('p');
          p.className = 'placeholder-text';
          p.textContent = 'Click an object in the simulation to see its properties.';
          this.selectedObjectContent.appendChild(p);
          return;
      }

      const item = this.engine.getItem(this.selectedItemIndex);
      const index = this.selectedItemIndex;

      this.selectedObjectInputs["mass"] = this.makeScalarInput(this.selectedObjectContent, "Mass", "mass", index);
      if (item instanceof Ball) {
        this.selectedObjectInputs["radius"] = this.makeScalarInput(this.selectedObjectContent, "Radius", "radius", index);
      }
  
      const [posX, posY] = this.makeVectorInput(this.selectedObjectContent, "Position", "position", index);
      this.selectedObjectInputs["positionX"] = posX;
      this.selectedObjectInputs["positionY"] = posY;
      
      const [velX, velY] = this.makeVectorInput(this.selectedObjectContent, "Velocity", "velocity", index);
      this.selectedObjectInputs["velocityX"] = velX;
      this.selectedObjectInputs["velocityY"] = velY;

      if (item instanceof Ball || item instanceof RigidBody) {
          const label = document.createElement("label");
          label.innerText = "Color";
          const colorInput = document.createElement("input");
          colorInput.type = "color";
          colorInput.className = "color-input";
          colorInput.value = item.color;
          colorInput.oninput = () => {
              eventBus.dispatch('itemPropertyChanged', { itemIndex: index, property: 'color', newValue: colorInput.value });
          };
          this.selectedObjectContent.appendChild(label);
          this.selectedObjectContent.appendChild(colorInput);
          this.selectedObjectInputs["color"] = colorInput;
      }
  }

  private updateSelectedObjectView(): void {
    if (this.selectedItemIndex === null) return;
    const item = this.engine.getItem(this.selectedItemIndex);
    if (!item) {
        this.selectedItemIndex = null;
        this.renderSelectedObject();
        return;
    }
    const inputs = this.selectedObjectInputs;
    if (document.activeElement !== inputs["mass"]) inputs["mass"].value = item.mass.toFixed(2);
    if (item instanceof Ball && document.activeElement !== inputs["radius"]) inputs["radius"].value = item.minRadius.toFixed(2);
    if (document.activeElement !== inputs["positionX"]) inputs["positionX"].value = item.position.x.toFixed(2);
    if (document.activeElement !== inputs["positionY"]) inputs["positionY"].value = item.position.y.toFixed(2);
    if (document.activeElement !== inputs["velocityX"]) inputs["velocityX"].value = item.velocity.x.toFixed(2);
    if (document.activeElement !== inputs["velocityY"]) inputs["velocityY"].value = item.velocity.y.toFixed(2);
  }

  addItem = () => {
    const posX = parseFloat(this.newItemPosXInput.value) || 0;
    const posY = parseFloat(this.newItemPosYInput.value) || 0;
    const velX = parseFloat(this.newItemVelXInput.value) || 0;
    const velY = parseFloat(this.newItemVelYInput.value) || 0;
    const mass = parseFloat(this.newItemMassInput.value) || 10;
    const radius = parseFloat(this.newItemRadiusInput.value) || 5;
    const color = this.newItemColorInput.value || "#000000";

    const newItem = new Ball(createVector(posX, posY), createVector(velX, velY), mass, radius, color);
    eventBus.dispatch('addItem', newItem);
  }

  updateSidebar() {
    for (let element of this.sidebarElements) {
      element.update();
    }
  }

  removeElement(e: SidebarElement) {
    let idx = this.sidebarElements.indexOf(e);
    if (idx > -1) this.sidebarElements.splice(idx, 1);
  }

  togglePlay = (evt: Event) => {
    this.playing = !this.playing;
    this.playPauseButton.innerText = this.playing ? "⏸" : "⏵";
  }

  textFieldChange = (evt: Event) => {
    let value = Number.parseFloat(this.speedInput.value);
    this.engineRepetitions = isNaN(value) ? 1 : value;
    this.speedInput.value = this.engineRepetitions.toFixed(2);
  }

  draw = () => {
    this.renderer.render();
    if (this.playing) {
      let n = Math.floor(this.queuedRepetitions);
      this.queuedRepetitions -= n;
      for (let i = 0; i < n; i++) this.engine.step();
      this.queuedRepetitions += this.engineRepetitions;
      this.updateSidebar();
      this.updateSelectedObjectView();
    }
    requestAnimationFrame(this.draw);
  }

  public makeScalarInput(container: HTMLElement, labelText: string, property: string, itemIndex: number): HTMLInputElement {
    const item = this.engine.getItem(itemIndex);
    const label = document.createElement("label");
    label.innerText = labelText;
    const input = document.createElement("input");
    input.type = "number";
    const value = (item as any)[property] ?? item.minRadius;
    input.placeholder = value.toFixed(2);
    input.value = value.toFixed(2);
    input.oninput = () => eventBus.dispatch('itemPropertyChanged', { itemIndex: itemIndex, property: property, newValue: input.value });
    container.appendChild(label);
    container.appendChild(input);
    return input;
  }

  public makeVectorInput(container: HTMLElement, labelText: string, property: string, itemIndex: number): [HTMLInputElement, HTMLInputElement] {
    const item = this.engine.getItem(itemIndex);
    const label = document.createElement("label");
    label.innerText = `${labelText} (x, y)`;
    const inputsWrapper = document.createElement("div");
    inputsWrapper.className = "vector-inputs";
    const inputX = document.createElement("input");
    inputX.type = "number";
    inputX.placeholder = (item as any)[property].x.toFixed(2);
    inputX.value = (item as any)[property].x.toFixed(2);
    inputX.oninput = () => eventBus.dispatch('itemPropertyChanged', { itemIndex: itemIndex, property: `${property}X`, newValue: inputX.value });
    const inputY = document.createElement("input");
    inputY.type = "number";
    inputY.placeholder = (item as any)[property].y.toFixed(2);
    inputY.value = (item as any)[property].y.toFixed(2);
    inputY.oninput = () => eventBus.dispatch('itemPropertyChanged', { itemIndex: itemIndex, property: `${property}Y`, newValue: inputY.value });
    inputsWrapper.appendChild(inputX);
    inputsWrapper.appendChild(inputY);
    container.appendChild(label);
    container.appendChild(inputsWrapper);
    return [inputX, inputY];
  }
}