import { createWorld, drawWorld, updateWorld } from "./game"
import "./style.css"

const canvas = document.querySelector<HTMLCanvasElement>("#game")!
const rect = canvas.getBoundingClientRect()
canvas.width = rect.width
canvas.height = rect.height

const ctx = canvas.getContext("2d")
if (ctx) {
	const world = createWorld(20, 20)

	let input: any = null
	document.addEventListener("keydown", evt => {
		switch (evt.code) {
			case "KeyW":
				input = { type: "up" }
				break
			case "KeyS":
				input = { type: "down" }
				break
			case "KeyA":
				input = { type: "left" }
				break
			case "KeyD":
				input = { type: "right" }
				break
			case "KeyQ":
				input = { type: "attack" }
				break
			case "KeyE":
				input = { type: "loot" }
				break
		}
	})

	let previous = performance.now()
	const raf = (time: number) => {
		const delta = time - previous
		previous = time
		updateWorld(world, delta / 1000, input)
		input = null
		drawWorld(world, ctx)
		requestAnimationFrame(raf)
	}
	requestAnimationFrame(raf)
}
