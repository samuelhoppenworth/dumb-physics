import { SimulatorEngine } from "./simulator/SimulatorEngine.js";
import { Ball, RigidBody } from "./simulator/Items.js";
import { Renderer } from "./ui/Renderer.js";
import { EventHandler } from "./ui/EventHandler.js";
import { UIHandler } from "./ui/UIHandler.js";
import { createVector } from "./simulator/Vector.js";

//get the canvas, canvas context, and dpi
let canvas: HTMLCanvasElement = document.getElementById("canvas")! as HTMLCanvasElement
let ctx = canvas.getContext("2d")!
ctx.scale(1, 1)
let dpi = window.devicePixelRatio

let renderingDiv = document.getElementById("canvasDiv")! as HTMLDivElement
canvas.width = renderingDiv.clientWidth
canvas.height = renderingDiv.clientHeight

let engine = new SimulatorEngine()

engine.addItem(new Ball(createVector(150, 100), createVector(20, 0), 5, 5, "#FF0000"))
engine.addItem(new Ball(createVector(200, 100), createVector(-20, 0), 5, 5, "#0000FF"))
engine.gravity = true
engine.attraction = false

let renderer = new Renderer(engine, 2, createVector(-5, 210), canvas, ctx)
let eventHandler = new EventHandler(document, renderer, engine, canvas)
let uiHandler = new UIHandler(canvas, engine, renderer, eventHandler)

uiHandler.draw()