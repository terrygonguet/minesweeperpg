import { createWorld, drawWorld, handleInput, updateWorld } from "./game"
import "./style.css"

const canvas = document.querySelector<HTMLCanvasElement>("#game")!
const rect = canvas.getBoundingClientRect()
canvas.width = rect.width
canvas.height = rect.height

const ctx = canvas.getContext("2d")
if (ctx) {
	const world = createWorld(21, 21)

	document.addEventListener("keydown", evt => {
		switch (evt.code) {
			case "KeyW":
				handleInput(world, { type: "keydown", key: "up" })
				break
			case "KeyS":
				handleInput(world, { type: "keydown", key: "down" })
				break
			case "KeyA":
				handleInput(world, { type: "keydown", key: "left" })
				break
			case "KeyD":
				handleInput(world, { type: "keydown", key: "right" })
				break
			case "KeyQ":
				handleInput(world, { type: "keydown", key: "attack" })
				break
			case "KeyE":
				handleInput(world, { type: "keydown", key: "loot" })
				break
		}
	})
	document.addEventListener("keyup", evt => {
		switch (evt.code) {
			case "KeyW":
				handleInput(world, { type: "keyup", key: "up" })
				break
			case "KeyS":
				handleInput(world, { type: "keyup", key: "down" })
				break
			case "KeyA":
				handleInput(world, { type: "keyup", key: "left" })
				break
			case "KeyD":
				handleInput(world, { type: "keyup", key: "right" })
				break
			case "KeyQ":
				handleInput(world, { type: "keyup", key: "attack" })
				break
			case "KeyE":
				handleInput(world, { type: "keyup", key: "loot" })
				break
		}
	})

	let previous = performance.now()
	const raf = (time: number) => {
		const delta = time - previous
		previous = time
		updateWorld(world, delta / 1000)
		drawWorld(world, ctx)
		requestAnimationFrame(raf)
	}
	requestAnimationFrame(raf)
}
