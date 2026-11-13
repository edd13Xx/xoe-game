import { afterEach, expect, it, vi } from "vitest"
import { focusSceneEntry } from "./scene-entry-focus.ts"
afterEach(()=>vi.unstubAllGlobals())
it("puts new boss and ending scene headings in view without animated scrolling",()=>{
 const heading={setAttribute:vi.fn(),focus:vi.fn(),scrollIntoView:vi.fn()}
 vi.stubGlobal("document",{querySelector:()=>heading})
 for(const [phase,previous] of [["moon-approach","moon-choice"],["ragnarok","moon-approach"],["ending","ragnarok"]])focusSceneEntry(phase,previous)
 expect(heading.focus).toHaveBeenCalledWith({preventScroll:true})
 expect(heading.scrollIntoView).toHaveBeenCalledWith({block:"start",behavior:"instant"})
 expect(heading.scrollIntoView).toHaveBeenCalledTimes(3)
})
it("leaves practice pause/resume position alone and resets the map without scrolling its hidden heading",()=>{
 const heading={setAttribute:vi.fn(),focus:vi.fn(),scrollIntoView:vi.fn()},scrollTo=vi.fn()
 vi.stubGlobal("document",{querySelector:()=>heading});vi.stubGlobal("window",{scrollTo})
 focusSceneEntry("practice-pause","practice");focusSceneEntry("practice","practice-pause");expect(heading.focus).not.toHaveBeenCalled()
 focusSceneEntry("colony-map","colony-lesson");expect(scrollTo).toHaveBeenCalledWith({top:0,behavior:"instant"});expect(heading.scrollIntoView).not.toHaveBeenCalled()
})
