local dataCardHeight = 300 
-- starting to calculate height of the dataCard: keywords and each section is 
-- 40px by default (will add row heights later), spacing adds 30 between each,
-- and I want 10 extra pixels at the bottom for a total of 60+30+40+30+40+30+40+10 = 260 (+10 for unknown reason) (70 for keywords)
local uiTemplates = {
    abilities = [[<Row class="${rowParity}" preferredHeight="80">
                    <Cell><Text class="ym-resizingSmallBold">${name}</Text></Cell>
                    <Cell><Text class="ym-resizingText">${desc}</Text></Cell>
                </Row>]],
    models = [[ <Row class="${rowParity}" preferredHeight="60">
                    <Cell><Text class="ym-resizingSmallBold">${name}</Text></Cell>
                    <Cell><Text class="ym-smallText">${m}</Text></Cell>
                    <Cell><Text class="ym-smallText">${ws}</Text></Cell>
                    <Cell><Text class="ym-smallText">${bs}</Text></Cell>
                    <Cell><Text class="ym-smallText">${s}</Text></Cell>
                    <Cell><Text class="ym-smallText">${t}</Text></Cell>
                    <Cell><Text class="ym-smallText">${w}</Text></Cell>
                    <Cell><Text class="ym-smallText">${a}</Text></Cell>
                    <Cell><Text class="ym-smallText">${ld}</Text></Cell>
                    <Cell><Text class="ym-smallText">${sv}</Text></Cell>
                </Row>]],
    weapons = [[ <Row class="${rowParity}" preferredHeight="60">
                    <Cell><Text class="ym-resizingSmallBold">${name}</Text></Cell>
                    <Cell><Text class="ym-resizingText">${range}</Text></Cell>
                    <Cell><Text class="ym-resizingText">${type}</Text></Cell>
                    <Cell><Text class="ym-smallText">${s}</Text></Cell>
                    <Cell><Text class="ym-smallText">${ap}</Text></Cell>
                    <Cell><Text class="ym-smallText">${d}</Text></Cell>
                    <Cell><Text class="ym-resizingText">${abilities}</Text></Cell>
                </Row>]],
    powersKnown = [[<Row class="${rowParity}" preferredHeight="100">
                        <Cell><Text class="ym-resizingSmallBold">${name}</Text></Cell>
                        <Cell><Text class="ym-smallText">${warpCharge}</Text></Cell>
                        <Cell><Text class="ym-smallText">${range}</Text></Cell>
                        <Cell><Text class="ym-resizingText">${details}</Text></Cell>
                    </Row>]],
    psykerProfiles = [[ <Row class="${rowParity}" preferredHeight="100">
                            <Cell><Text class="ym-resizingSmallBold">${name}</Text></Cell>
                            <Cell><Text class="ym-smallText">${cast}</Text></Cell>
                            <Cell><Text class="ym-smallText">${deny}</Text></Cell>
                            <Cell><Text class="ym-resizingText">${known}</Text></Cell>
                        </Row>]],
    agenda = [[ <HorizontalLayout>
                    <Text class="ym-medText" flexibleWidth="1">${counterName}</Text>
                    <HorizontalLayout spacing="5">
                        <Button class="ym-button" onClick="${guid}/decrementTallyCounter(${counterName})">-</Button>
                        <Text class="ym-bold" id="${counterID}">${counterValue}</Text>
                        <Button class="ym-button" onClick="${guid}/incrementTallyCounter(${counterName})">+</Button>
                    </HorizontalLayout>
                </HorizontalLayout>]],
    -- this is here and not in xml because we have to provide the guid, otherwise it will try and run on Global
    buttons = [[<Button class="highlightingButton" preferredWidth="${width}" color="#BB2222" onClick="${guid}/highlightUnit(Red)"></Button>
    <Button class="highlightingButton" preferredWidth="${width}" color="#22BB22" onClick="${guid}/highlightUnit(Green)"></Button>
    <Button class="highlightingButton" preferredWidth="${width}" color="#2222BB" onClick="${guid}/highlightUnit(Blue)"></Button>
    <Button class="highlightingButton" preferredWidth="${width}" color="#BB22BB" onClick="${guid}/highlightUnit(Purple)"></Button>
    <Button class="highlightingButton" preferredWidth="${width}" color="#DDDD22" onClick="${guid}/highlightUnit(Yellow)"></Button>
    <Button class="highlightingButton" preferredWidth="${width}" color="#FFFFFF" onClick="${guid}/highlightUnit(White)"></Button>
    <Button class="highlightingButton" preferredWidth="${width}" color="#DD6633" onClick="${guid}/highlightUnit(Orange)"></Button>
    <Button class="highlightingButton" preferredWidth="${width}" color="#29D9D9" onClick="${guid}/highlightUnit(Teal)"></Button>
    <Button class="highlightingButton" preferredWidth="${width}" color="#DD77CC" onClick="${guid}/highlightUnit(Pink)"></Button>
    <Button class="highlightingButton" preferredWidth="${width}" color="#BBBBBB" onClick="${guid}/unhighlightUnit"></Button>]]
}