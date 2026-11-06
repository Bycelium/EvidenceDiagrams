const DEFAULT_PRIOR = Object.freeze({ mean: 0, standardDeviation: 5 });
const REPORTED_FACT_PRIOR = Object.freeze({ mean: 8, standardDeviation: 2 });

function claim(id, title, description, prior = DEFAULT_PRIOR) {
  return { id, title, description, prior: { ...prior } };
}

function reportedFact(id, title, description) {
  return claim(id, title, description, REPORTED_FACT_PRIOR);
}

function evidence(id, contributionId, premiseClaimId, targetClaimId, deltaMean, deltaStandardDeviation, relayContributionIds) {
  return {
    id,
    contributionId,
    ...(relayContributionIds ? { relayContributionIds: [...relayContributionIds] } : {}),
    premiseClaimId,
    targetClaimId,
    impact: { deltaMean, deltaStandardDeviation },
  };
}

const nuclear = {
  id: 'nuclear',
  inquiry: {
    rootClaimId: 'nuclear.root',
    claims: [
      claim('nuclear.root', 'Nuclear is dangerous', 'Considering accidents, uranium mining, occupational radiation exposure, and routine operations, nuclear electricity causes a high number of deaths.'),
      claim('nuclear.published-comparison', 'Nuclear power has far lower death rates than coal and gas', 'Published deaths-per-TWh estimates place nuclear far below coal and gas.'),
      claim('nuclear.renewables-comparison', 'Nuclear mortality is in the same low range as wind and solar', 'Our World in Data reports 0.03 deaths per TWh for nuclear, 0.04 for wind, and 0.02 for solar from a compilation of accidents and air pollution across differing methods. Uncertainty in these low estimates prevents a reliable ranking.'),
      claim('nuclear.avoided-fossil-mortality', 'Historical nuclear generation avoided substantial fossil-fuel mortality', 'A modeled historical counterfactual estimates that nuclear generation prevented a substantial worldwide air-pollution death burden by displacing predominantly coal generation.'),
      claim('nuclear.chernobyl-tv-argument', 'Chernobyl demonstrates a high nuclear mass-casualty risk', 'Illustrative viewer inference: the 1986 accident’s portrayed and reported fatal toll is sufficient to infer that nuclear power poses a high mass-casualty risk.'),
      claim('nuclear.fukushima-argument', 'Fukushima shows an unusually high nuclear casualty risk', 'The Fukushima accident indicates that nuclear electricity has an unusually high casualty risk.'),
      claim('nuclear.coal-us-mortality', 'Coal pollution caused substantial deaths among older U.S. adults', 'Coal-plant air pollution caused a substantial mortality burden among U.S. adults aged 65 and older from 1999 through 2020. This scoped coal finding complements the broader published comparison; it does not itself establish nuclear or gas death rates.'),
      claim('nuclear.uranium-mining-risk', 'Uranium mining radon raises lung-cancer mortality risk', 'Occupational radon exposure in uranium mining adds a lung-cancer fatality hazard to the nuclear fuel cycle.'),
      claim('nuclear.worker-radiation-risk', 'Low-dose radiation is associated with nuclear-worker cancer mortality', 'Protracted low-dose external radiation exposure among nuclear-industry workers is associated with increased solid-cancer mortality.'),
      claim('nuclear.fukushima-followup', 'No radiation-attributable resident effects were documented at Fukushima', 'UNSCEAR’s follow-up found no documented radiation-attributable health effects among Fukushima residents and considers any future increase unlikely to be discernible. This does not imply zero accident-related harm or zero individual risk.'),
      claim('nuclear.fukushima-displacement-risk', 'Fukushima displacement supports substantial non-radiation harm', 'The accident’s mass evacuation and lasting displacement support an inference of substantial non-radiation health consequences.'),
      claim('nuclear.hydropower-catastrophe-argument', 'Banqiao and Shimantan show catastrophic hydropower risk', 'PSI and OECD/NEA classify the 1975 Banqiao–Shimantan dam failures in their hydropower accident comparisons. The event demonstrates that catastrophic dam failures can cause mass fatalities; its historical toll alone does not quantify present-day hydropower risk.'),
      reportedFact('nuclear.owid-rates', 'OWID reports nuclear at 0.03 deaths per TWh', 'Our World in Data reports deaths per TWh of 24.62 for coal, 2.82 for gas, 0.03 for nuclear, 0.04 for wind, and 0.02 for solar, combining accidents and air pollution across studies, methods, regions, and periods; small differences among low-mortality sources are uncertain.'),
      reportedFact('nuclear.lancet-rates', 'The Lancet estimated nuclear below coal and gas deaths per TWh', 'The 2007 Lancet review, an underlying input to the later compilation, estimated European deaths per TWh of 24.62 for coal, 2.821 for gas, and 0.074 for nuclear after summing occupational, public-accident, and air-pollution effects.'),
      reportedFact('nuclear.psi-yoll-comparison', 'PSI estimated fewer life-years lost for nuclear normal operation', 'For German energy chains in 2000, PSI Table 4 reports normal-operation mortality of 0.068 years of life lost per GWh for hard coal, 0.023 for natural gas, and 0.005 for nuclear. The unit is YOLL/GWh, the calculation follows complete energy chains from extraction through waste, and severe accidents are reported separately. Its normal-operation analysis uses the ExternE methodological lineage that also informs the Lancet estimates.'),
      reportedFact('nuclear.kharecha-avoided-deaths', 'Kharecha and Hansen estimate 1.84 million avoided deaths', 'Kharecha and Hansen estimate that historical nuclear power prevented 1.84 million net air-pollution deaths worldwide from 1971 through 2009. The modeled counterfactual assumes predominantly coal replacement; no deaths were individually observed as avoided.'),
      reportedFact('nuclear.henneman-coal-deaths', 'A study estimates 460,000 U.S. coal-related excess deaths', 'Henneman and colleagues modeled 460,000 excess deaths, with a 95% confidence interval of 420,000 to 500,000, attributable to coal sulfur-dioxide-related PM2.5 in the United States from 1999 through 2020. It uses a Medicare cohort aged 65 and older and does not provide a universal deaths-per-TWh rate.'),
      reportedFact('nuclear.puma-risk', 'PUMA models excess lung-cancer risk from miners’ radon exposure', 'PUMA followed 119,709 male uranium miners over 4.3 million person-years and observed 7,754 lung-cancer deaths in the cohort; this is not a number attributed to occupational radiation. Its modeled lifetime excess absolute risk per working-level month was 5.38 to 5.57 × 10⁻⁴ for the full cohort.'),
      reportedFact('nuclear.inworks-risk', 'INWORKS reports a dose-associated increase in solid-cancer mortality', 'INWORKS followed 309,932 radiation-monitored workers in France, the United Kingdom, and the United States over 10.7 million person-years; 28,089 solid-cancer deaths occurred in the cohort rather than an attributable-death count. Mortality increased by an estimated 52% per Gy with a 10-year lag (90% confidence interval 27% to 77%).'),
      reportedFact('nuclear.chernobyl-acute', 'UNSCEAR reports 28 early Chernobyl worker deaths', 'UNSCEAR reports 134 cases of acute radiation sickness among Chernobyl workers, with 28 deaths within three months.'),
      reportedFact('nuclear.chernobyl-dramatization', 'The miniseries reconstructs events with dramatization and composite characters', 'The official HBO and Sky companion podcast discusses when and why the production departed from events and identifies Ulana Khomyuk as a composite of real scientists.'),
      reportedFact('nuclear.chernobyl-later-effects', '15 deaths recorded by 2005 among about 6,800 thyroid cancer cases', 'UNSCEAR recorded 6,848 thyroid cancers during 1991–2005 among people who were under 18 in 1986 across Belarus, Ukraine, and the four most affected Russian regions, including 15 fatal cases by 2005; it linked a substantial fraction to radioiodine without attributing every case individually. This tally covers thyroid-cancer follow-up through 2005; total accident mortality includes other causes and later periods. Its historical 2008 assessment found no clear evidence of radiation-related increases in other solid cancers or leukaemia in the general population, while noting indications of leukaemia among higher-dose recovery workers.'),
      reportedFact('nuclear.chernobyl-projection-exposed', 'WHO projected up to about 4,000 lifetime deaths in higher-exposed groups', 'The Chernobyl Forum projected up to about 4,000 eventual radiation-related deaths among roughly 600,000 higher-exposed emergency workers, evacuees, and residents, combining deaths already known with a statistical projection over their lifetimes.'),
      reportedFact('nuclear.chernobyl-projection-europe', 'IARC projected about 16,000 cancer deaths across Europe by 2065', 'IARC models projected about 16,000 radiation-related cancer deaths across Europe through 2065, with a 95% uncertainty interval from 6,700 to 38,000; these are modeled excess deaths rather than observed individual attributions.'),
      reportedFact('nuclear.fukushima-acute', 'WHO reports no acute Fukushima radiation deaths', 'WHO reports no acute radiation injuries or acute deaths among workers or the public from radiation exposure caused by the Fukushima nuclear accident. This acute-radiation scope does not count evacuation or displacement harms and does not establish zero long-term individual risk.'),
      reportedFact('nuclear.fukushima-evacuation', 'UNSCEAR associates evacuee health changes with social conditions', 'UNSCEAR reports health changes among Fukushima evacuees probably associated with social and lifestyle changes rather than radiation exposure.'),
      reportedFact('nuclear.unscear-followup-finding', 'UNSCEAR found no documented resident radiation effects', 'UNSCEAR reports no documented adverse health effects among Fukushima residents directly attributable to radiation exposure and expects any future increase to be unlikely to be discernible. This finding does not imply zero accident-related harm or zero individual risk.'),
      reportedFact('nuclear.banqiao-deaths', 'PSI reports about 26,000 Banqiao–Shimantan floodwave deaths', 'PSI reports approximately 26,000 people killed by immediate floodwaves in the 1975 Banqiao and Shimantan dam failures.'),
    ],
    contributions: [
      {
        id: 'nuclear.owid-rates',
        title: 'Our World in Data: Death rates from energy production per TWh',
        url: 'https://ourworldindata.org/grapher/death-rates-from-energy-production-per-twh?tab=table',
        locator: '2021 estimates · table values combine deaths from accidents and air pollution',
      },
      {
        id: 'nuclear.lancet-2007',
        title: 'The Lancet: Electricity generation and health',
        url: 'https://www.sciencedirect.com/science/article/pii/S0140673607612537',
        locator: 'Published 2007 · Table 2, estimated deaths per TWh in Europe',
      },
      {
        id: 'nuclear.nea-full-costs',
        title: 'OECD Nuclear Energy Agency: The Full Costs of Electricity Provision',
        url: 'https://www.oecd.org/content/dam/oecd/en/publications/reports/2018/06/the-full-costs-of-electricity-provision_g1g90cd4/9789264303119-en.pdf#page=118',
        locator: 'Published 2018 · Table 5.2, printed p. 116 (PDF p. 118) · reproduction of the 2007 Lancet estimates',
      },
      {
        id: 'nuclear.psi-german-sustainability',
        title: 'Paul Scherrer Institute: Strengths and Weaknesses of Current Energy Chains in a Sustainable Development Perspective',
        url: 'https://www.psi.ch/sites/default/files/import/ta/IlkEN/Hirschberg_etal_2006.pdf#page=7',
        locator: 'Published July 2006 · Table 4, printed p. 453 (PDF p. 7) · normal-operation YOLL/GWh for German energy chains in 2000',
      },
      {
        id: 'nuclear.nasa-kharecha-summary',
        title: 'NASA GISS: Coal and Gas are Far More Harmful than Nuclear Power',
        url: 'https://www.giss.nasa.gov/research/briefs/2013_kharecha_02/',
        locator: 'Published April 2013 · authors’ summary of avoided mortality from historical nuclear generation, 1971–2009',
      },
      {
        id: 'nuclear.kharecha-hansen-2013',
        title: 'Kharecha and Hansen: Prevented Mortality and Greenhouse Gas Emissions from Historical and Projected Nuclear Power',
        url: 'https://ntrs.nasa.gov/api/citations/20140017100/downloads/20140017100.pdf',
        locator: 'Published 2013 · pp. 4889–4891, Table 1 and historical replacement scenario · DOI 10.1021/es3051197',
      },
      {
        id: 'nuclear.press-energy-mortality-comparison',
        title: 'The Washington Post: Nuclear power is safest way to make electricity, according to study',
        url: 'https://www.washingtonpost.com/national/nuclear-power-is-safest-way-to-make-electricity-according-to-2007-study/2011/03/22/AFQUbyQC_story.html',
        locator: '2 April 2011 · reports the Lancet comparison of nuclear, coal, and natural-gas health effects',
      },
      {
        id: 'nuclear.press-coal-mortality',
        title: 'Scientific American and E&E News: Coal Power Kills a Staggering Number of Americans',
        url: 'https://www.scientificamerican.com/article/coal-power-kills-a-staggering-number-of-americans/',
        locator: '28 November 2023 · cites the Science study; cohort scale is person-years, not people',
      },
      {
        id: 'nuclear.henneman-science-2023',
        title: 'Science: Mortality risk from United States coal electricity generation',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10870829/',
        locator: 'Published 23 November 2023 · DOI 10.1126/science.adf4915',
      },
      {
        id: 'nuclear.uranium-mining-review',
        title: 'Environmental Health: Uranium mining and lung cancer, a legacy of the nuclear age',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12558138/',
        locator: '2025 review · uranium-miner radon exposure and lung-cancer evidence',
      },
      {
        id: 'nuclear.puma-2024',
        title: 'PUMA: Lifetime excess lung-cancer risk from radon exposure',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10920468/',
        locator: '2024 study · PMID 38172372 · DOI 10.1007/s00411-023-01049-w',
      },
      {
        id: 'nuclear.cnsc-inworks',
        title: 'Canadian Nuclear Safety Commission: INWORKS cancer mortality study',
        url: 'https://www.cnsc-ccsn.gc.ca/eng/nuclear-safety-security/science-research-health/health/inworks-study/',
        locator: '2024 information page · interpretation of the 2023 INWORKS update',
      },
      {
        id: 'nuclear.inworks-2023',
        title: 'The BMJ: Cancer mortality after low-dose exposure in nuclear workers',
        url: 'https://www.bmj.com/content/382/bmj-2022-074520',
        locator: '2023 cohort study · 309,932 workers · DOI 10.1136/bmj-2022-074520',
      },
      {
        id: 'nuclear.hbo-chernobyl',
        title: 'HBO: Chernobyl',
        url: 'https://www.hbo.com/chernobyl',
        locator: '2019 miniseries · dramatized portrayal of the 1986 accident',
      },
      {
        id: 'nuclear.hbo-chernobyl-podcast',
        title: 'HBO and Sky: The Chernobyl Podcast',
        url: 'https://podcasts.apple.com/us/podcast/the-chernobyl-podcast/id1459712981',
        locator: 'Official 2019 companion · episodes 1–2 discuss departures from events and the composite character Ulana Khomyuk',
      },
      {
        id: 'nuclear.unscear-chernobyl',
        title: 'UNSCEAR 2008 Report, Annex D (published 2011): Health effects due to radiation from the Chernobyl accident',
        url: 'https://www.unscear.org/unscear/uploads/documents/publications/UNSCEAR_2008_Annex-D-CORR.pdf',
        locator: '§§2, 66, 99 · thyroid cases: §66, printed p. 60 (PDF p. 20); thyroid deaths: §99, printed pp. 64–65 (PDF pp. 24–25); acute deaths: §2 and §99',
      },
      {
        id: 'nuclear.who-chernobyl-forum',
        title: 'WHO: Chernobyl, the true scale of the accident',
        url: 'https://www.who.int/news/item/05-09-2005-chernobyl-the-true-scale-of-the-accident',
        locator: '5 September 2005 · Chernobyl Forum projection for higher-exposed populations',
      },
      {
        id: 'nuclear.iarc-chernobyl',
        title: 'IARC: Estimates of the cancer burden in Europe from radioactive fallout from Chernobyl',
        url: 'https://www.iarc.who.int/wp-content/uploads/2018/07/IARCBriefingChernobyl.pdf',
        locator: '2006 briefing · Europe projections through 2065 and 95% uncertainty intervals',
      },
      {
        id: 'nuclear.iaea-fukushima-accident',
        title: 'IAEA: The Fukushima Daiichi Accident',
        url: 'https://www-pub.iaea.org/mtcd/publications/pdf/pub1710-reportbythedg-web.pdf',
        locator: '2015 Director General’s report · causes, consequences, evacuation, and lessons',
      },
      {
        id: 'nuclear.who-fukushima',
        title: 'WHO: Health consequences of Fukushima nuclear accident',
        url: 'https://www.who.int/news-room/questions-and-answers/item/health-consequences-of-fukushima-nuclear-accident',
        locator: 'Updated 10 March 2016 · acute radiation injuries and deaths',
      },
      {
        id: 'nuclear.unscear-fukushima',
        title: 'UNSCEAR 2020/2021 Fukushima Report: questions and answers',
        url: 'https://www.unscear.org/unscear/en/areas-of-work/fukushima-report-faq.html',
        locator: 'Questions 3–4 · resident radiation effects and observed evacuee conditions',
      },
      {
        id: 'nuclear.press-fukushima-context',
        title: 'The Guardian: Fukushima meltdown did not damage health, UN says',
        url: 'https://www.theguardian.com/environment/2021/mar/10/fukushima-meltdown-did-not-damage-health-un-japan',
        locator: '10 March 2021 · reports the UNSCEAR assessment, mass evacuation, and lasting displacement',
      },
      {
        id: 'nuclear.psi-banqiao',
        title: 'Paul Scherrer Institute: Comparative Assessment of Severe Accidents in the Chinese Energy Sector',
        url: 'https://www.psi.ch/sites/default/files/import/ta/CeptEN/CETP_RA_Report.pdf#page=89',
        locator: '2003 report · pp. 73–74 (PDF pp. 89–90), §4.6.3, Table 16 · approximately 26,000 immediate floodwave deaths',
      },
      {
        id: 'nuclear.nea-comparing-risks',
        title: 'OECD Nuclear Energy Agency: Comparing Nuclear Accident Risks with Those from Other Energy Sources',
        url: 'https://www.oecd-nea.org/upload/docs/application/pdf/2019-12/nea6861-comparing-risks.pdf#page=30',
        locator: '2010 report · pp. 34–36 (PDF pp. 30–32), §5.1 · Banqiao context and OECD/non-OECD variation',
      },
    ],
    evidence: [
      evidence('nuclear.e-comparison-root', 'nuclear.lancet-2007', 'nuclear.published-comparison', 'nuclear.root', -20, -0.6, ['nuclear.press-energy-mortality-comparison']),
      evidence('nuclear.e-renewables-root', 'nuclear.owid-rates', 'nuclear.renewables-comparison', 'nuclear.root', -10, 0),
      evidence('nuclear.e-avoided-mortality-root', 'nuclear.nasa-kharecha-summary', 'nuclear.avoided-fossil-mortality', 'nuclear.root', -6, 0),
      evidence('nuclear.e-chernobyl-root', 'nuclear.hbo-chernobyl', 'nuclear.chernobyl-tv-argument', 'nuclear.root', 15, 0.2),
      evidence('nuclear.e-fukushima-root', 'nuclear.iaea-fukushima-accident', 'nuclear.fukushima-argument', 'nuclear.root', 15, 0.2),
      evidence('nuclear.e-coal-us-comparison', 'nuclear.henneman-science-2023', 'nuclear.coal-us-mortality', 'nuclear.published-comparison', 4, 0, ['nuclear.press-coal-mortality']),
      evidence('nuclear.e-hydropower-root', 'nuclear.nea-comparing-risks', 'nuclear.hydropower-catastrophe-argument', 'nuclear.root', -2, 0),
      evidence('nuclear.e-uranium-mining-root', 'nuclear.uranium-mining-review', 'nuclear.uranium-mining-risk', 'nuclear.root', 3, 0.2),
      evidence('nuclear.e-worker-radiation-root', 'nuclear.cnsc-inworks', 'nuclear.worker-radiation-risk', 'nuclear.root', 3, 0.2),
      evidence('nuclear.e-rates-comparison', 'nuclear.owid-rates', 'nuclear.owid-rates', 'nuclear.published-comparison', 5, -0.6),
      evidence('nuclear.e-rates-renewables-comparison', 'nuclear.owid-rates', 'nuclear.owid-rates', 'nuclear.renewables-comparison', 5, 0),
      evidence('nuclear.e-lancet-owid', 'nuclear.lancet-2007', 'nuclear.lancet-rates', 'nuclear.owid-rates', 2, -0.2),
      evidence('nuclear.e-nea-comparison', 'nuclear.nea-full-costs', 'nuclear.lancet-rates', 'nuclear.published-comparison', 0, 0),
      evidence('nuclear.e-psi-comparison', 'nuclear.psi-german-sustainability', 'nuclear.psi-yoll-comparison', 'nuclear.published-comparison', 3, -0.2),
      evidence('nuclear.e-kharecha-estimate', 'nuclear.kharecha-hansen-2013', 'nuclear.kharecha-avoided-deaths', 'nuclear.avoided-fossil-mortality', 7, -0.3),
      evidence('nuclear.e-lancet-kharecha-lineage', 'nuclear.kharecha-hansen-2013', 'nuclear.lancet-rates', 'nuclear.kharecha-avoided-deaths', 1, 0),
      evidence('nuclear.e-henneman-coal', 'nuclear.henneman-science-2023', 'nuclear.henneman-coal-deaths', 'nuclear.coal-us-mortality', 10, -0.4),
      evidence('nuclear.e-puma-risk', 'nuclear.puma-2024', 'nuclear.puma-risk', 'nuclear.uranium-mining-risk', 10, -0.4),
      evidence('nuclear.e-inworks-risk', 'nuclear.inworks-2023', 'nuclear.inworks-risk', 'nuclear.worker-radiation-risk', 10, -0.4),
      evidence('nuclear.e-chernobyl-acute', 'nuclear.unscear-chernobyl', 'nuclear.chernobyl-acute', 'nuclear.chernobyl-tv-argument', 3, -0.2),
      evidence('nuclear.e-chernobyl-dramatization', 'nuclear.hbo-chernobyl-podcast', 'nuclear.chernobyl-dramatization', 'nuclear.chernobyl-tv-argument', -10, -0.4),
      evidence('nuclear.e-chernobyl-later-effects', 'nuclear.unscear-chernobyl', 'nuclear.chernobyl-later-effects', 'nuclear.chernobyl-tv-argument', -16, -0.8),
      evidence('nuclear.e-chernobyl-projection-exposed', 'nuclear.who-chernobyl-forum', 'nuclear.chernobyl-projection-exposed', 'nuclear.chernobyl-tv-argument', 4, 0.3),
      evidence('nuclear.e-chernobyl-projection-europe', 'nuclear.iarc-chernobyl', 'nuclear.chernobyl-projection-europe', 'nuclear.chernobyl-tv-argument', 4, 0.5),
      evidence('nuclear.e-fukushima-acute', 'nuclear.who-fukushima', 'nuclear.fukushima-acute', 'nuclear.fukushima-argument', -15, -0.2),
      evidence('nuclear.e-fukushima-displacement', 'nuclear.press-fukushima-context', 'nuclear.fukushima-displacement-risk', 'nuclear.fukushima-argument', 2, 0.2),
      evidence('nuclear.e-fukushima-followup', 'nuclear.unscear-fukushima', 'nuclear.fukushima-followup', 'nuclear.fukushima-argument', -12, 0, ['nuclear.press-fukushima-context']),
      evidence('nuclear.e-unscear-evacuation', 'nuclear.unscear-fukushima', 'nuclear.fukushima-evacuation', 'nuclear.fukushima-displacement-risk', 10, -0.4),
      evidence('nuclear.e-unscear-followup', 'nuclear.unscear-fukushima', 'nuclear.unscear-followup-finding', 'nuclear.fukushima-followup', 10, -0.4),
      evidence('nuclear.e-banqiao-deaths', 'nuclear.psi-banqiao', 'nuclear.banqiao-deaths', 'nuclear.hydropower-catastrophe-argument', 10, -0.4),
    ],
  },
};

const french = {
  nuclear: {
    titles: {
      'nuclear.root': 'Le nucléaire est dangereux',
      'nuclear.published-comparison': 'Le nucléaire a un taux de mortalité très inférieur au charbon et au gaz',
      'nuclear.renewables-comparison': 'La mortalité du nucléaire est du même faible ordre que celle de l’éolien et du solaire',
      'nuclear.avoided-fossil-mortality': 'Le nucléaire aurait évité de nombreux décès liés aux énergies fossiles',
      'nuclear.chernobyl-tv-argument': 'Tchernobyl démontre un risque nucléaire élevé de pertes humaines massives',
      'nuclear.fukushima-argument': 'Fukushima révèle un risque nucléaire de victimes exceptionnellement élevé',
      'nuclear.coal-us-mortality': 'La pollution du charbon a causé une forte mortalité chez les Américains âgés',
      'nuclear.uranium-mining-risk': 'Le radon des mines d’uranium accroît le risque de mortalité par cancer du poumon',
      'nuclear.worker-radiation-risk': 'Les faibles doses sont associées à la mortalité par cancer chez les travailleurs du nucléaire',
      'nuclear.fukushima-followup': 'Aucun effet attribuable aux rayonnements n’est documenté chez les habitants de Fukushima',
      'nuclear.fukushima-displacement-risk': 'Les déplacements de Fukushima étayent d’importants dommages non radiologiques',
      'nuclear.hydropower-catastrophe-argument': 'Banqiao et Shimantan révèlent un risque hydroélectrique catastrophique',
      'nuclear.owid-rates': 'OWID indique 0,03 décès nucléaires par TWh',
      'nuclear.lancet-rates': 'The Lancet estime le nucléaire sous le charbon et le gaz en décès par TWh',
      'nuclear.psi-yoll-comparison': 'Le PSI estime moins d’années de vie perdues pour le fonctionnement normal du nucléaire',
      'nuclear.kharecha-avoided-deaths': 'Kharecha et Hansen estiment 1,84 million de décès évités',
      'nuclear.henneman-coal-deaths': 'Une étude estime 460 000 décès supplémentaires liés au charbon aux États-Unis',
      'nuclear.puma-risk': 'PUMA modélise le risque supplémentaire de cancer pulmonaire lié au radon des mineurs',
      'nuclear.inworks-risk': 'INWORKS rapporte une hausse de mortalité par cancer solide associée à la dose',
      'nuclear.chernobyl-acute': 'L’UNSCEAR rapporte 28 décès précoces de travailleurs à Tchernobyl',
      'nuclear.chernobyl-dramatization': 'La minisérie reconstruit les événements avec dramatisation et personnages composites',
      'nuclear.chernobyl-later-effects': '15 décès recensés jusqu’en 2005 parmi environ 6 800 cancers de la thyroïde',
      'nuclear.chernobyl-projection-exposed': 'L’OMS projette jusqu’à environ 4 000 décès sur la vie entière dans les groupes les plus exposés',
      'nuclear.chernobyl-projection-europe': 'Le CIRC projette environ 16 000 décès par cancer en Europe d’ici 2065',
      'nuclear.fukushima-acute': 'L’OMS ne rapporte aucun décès aigu dû aux rayonnements à Fukushima',
      'nuclear.fukushima-evacuation': 'L’UNSCEAR associe les troubles des évacués aux conditions sociales',
      'nuclear.unscear-followup-finding': 'L’UNSCEAR n’a documenté aucun effet radiologique chez les habitants',
      'nuclear.banqiao-deaths': 'Le PSI rapporte environ 26 000 décès dus aux crues de Banqiao et Shimantan',
    },
    descriptions: {
      'nuclear.root': 'En tenant compte des accidents, des mines d’uranium, de l’exposition professionnelle aux rayonnements et des opérations courantes, l’électricité nucléaire cause un nombre élevé de décès.',
      'nuclear.published-comparison': 'Les estimations publiées de décès par TWh placent le nucléaire très en dessous du charbon et du gaz.',
      'nuclear.renewables-comparison': 'Our World in Data rapporte 0,03 décès par TWh pour le nucléaire, 0,04 pour l’éolien et 0,02 pour le solaire à partir d’une compilation des accidents et de la pollution de l’air selon des méthodes différentes. L’incertitude de ces faibles estimations ne permet pas d’établir un classement fiable.',
      'nuclear.avoided-fossil-mortality': 'L’étude estime que, sans la production nucléaire de 1971 à 2009, le recours accru au charbon et au gaz aurait causé davantage de décès par pollution de l’air dans le monde.',
      'nuclear.chernobyl-tv-argument': 'Interprétation illustrative d’un spectateur : le bilan humain dépeint et rapporté de l’accident de 1986 suffit à inférer que l’énergie nucléaire présente un risque élevé de pertes humaines massives.',
      'nuclear.fukushima-argument': 'L’accident de Fukushima indique que l’électricité nucléaire présente un risque de victimes exceptionnellement élevé.',
      'nuclear.coal-us-mortality': 'La pollution atmosphérique des centrales à charbon a causé une importante mortalité chez les adultes de 65 ans ou plus aux États-Unis de 1999 à 2020. Ce résultat circonscrit sur le charbon complète la comparaison publiée plus générale ; il n’établit pas à lui seul les taux de mortalité du nucléaire ou du gaz.',
      'nuclear.uranium-mining-risk': 'L’exposition professionnelle au radon dans les mines d’uranium ajoute au cycle du combustible nucléaire un risque de décès par cancer du poumon.',
      'nuclear.worker-radiation-risk': 'L’exposition externe prolongée à de faibles doses chez les travailleurs de l’industrie nucléaire est associée à une mortalité accrue par cancer solide.',
      'nuclear.fukushima-followup': 'Le suivi de l’UNSCEAR n’a constaté aucun effet sanitaire attribuable aux rayonnements chez les habitants de Fukushima et estime qu’une éventuelle augmentation future sera probablement indiscernable. Cela ne signifie ni absence de dommages liés à l’accident ni risque individuel nul.',
      'nuclear.fukushima-displacement-risk': 'L’évacuation massive et les déplacements durables causés par l’accident étayent l’inférence d’importantes conséquences sanitaires non radiologiques.',
      'nuclear.hydropower-catastrophe-argument': 'Le PSI et l’AEN de l’OCDE classent les ruptures des barrages de Banqiao et Shimantan en 1975 parmi les accidents hydroélectriques. L’événement montre que des ruptures de barrage catastrophiques peuvent causer des pertes humaines massives ; son bilan historique seul ne quantifie pas le risque hydroélectrique actuel.',
      'nuclear.owid-rates': 'Our World in Data indique 24,62 décès par TWh pour le charbon, 2,82 pour le gaz, 0,03 pour le nucléaire, 0,04 pour l’éolien et 0,02 pour le solaire, en combinant accidents et pollution de l’air selon des études, méthodes, régions et périodes diverses ; les faibles écarts entre filières à faible mortalité sont incertains.',
      'nuclear.lancet-rates': 'La synthèse du Lancet de 2007, reprise comme source par la compilation ultérieure, estimait en Europe 24,62 décès par TWh pour le charbon, 2,821 pour le gaz et 0,074 pour le nucléaire après addition des effets professionnels, des accidents publics et de la pollution de l’air.',
      'nuclear.psi-yoll-comparison': 'Pour les chaînes énergétiques allemandes en 2000, le tableau 4 du PSI rapporte une mortalité en fonctionnement normal de 0,068 année de vie perdue par GWh pour la houille, 0,023 pour le gaz naturel et 0,005 pour le nucléaire. L’unité est l’année de vie perdue par GWh, le calcul suit les chaînes complètes de l’extraction aux déchets et les accidents graves sont présentés séparément. Son analyse du fonctionnement normal emploie la lignée méthodologique ExternE qui informe aussi les estimations du Lancet.',
      'nuclear.kharecha-avoided-deaths': 'Kharecha et Hansen estiment que l’énergie nucléaire historique a évité 1,84 million de décès nets dus à la pollution de l’air dans le monde de 1971 à 2009. Le contrefactuel modélisé suppose un remplacement principalement par le charbon ; aucun décès évité n’a été observé individuellement.',
      'nuclear.henneman-coal-deaths': 'Henneman et ses collègues ont modélisé 460 000 décès supplémentaires, avec un intervalle de confiance à 95 % de 420 000 à 500 000, attribuables aux PM2,5 liées au dioxyde de soufre du charbon aux États-Unis de 1999 à 2020. L’étude utilise une cohorte Medicare de 65 ans ou plus et ne fournit pas de taux universel de décès par TWh.',
      'nuclear.puma-risk': 'PUMA a suivi 119 709 mineurs d’uranium pendant 4,3 millions de personnes-années et observé 7 754 décès par cancer du poumon dans la cohorte ; ce n’est pas un nombre attribué aux rayonnements professionnels. Son risque absolu supplémentaire modélisé sur la vie entière par mois-niveau de travail est de 5,38 à 5,57 × 10⁻⁴ pour la cohorte complète.',
      'nuclear.inworks-risk': 'INWORKS a suivi 309 932 travailleurs surveillés pour les rayonnements en France, au Royaume-Uni et aux États-Unis pendant 10,7 millions de personnes-années ; 28 089 décès par cancer solide sont survenus dans la cohorte, et non un nombre de décès attribuables. La mortalité augmente de 52 % par Gy avec un décalage de dix ans selon l’estimation (intervalle de confiance à 90 % de 27 à 77 %).',
      'nuclear.chernobyl-acute': 'L’UNSCEAR rapporte 134 cas de syndrome d’irradiation aiguë chez les travailleurs de Tchernobyl, dont 28 décès dans les trois mois.',
      'nuclear.chernobyl-dramatization': 'Le podcast officiel de HBO et Sky explique quand et pourquoi la production s’est écartée des événements et présente Ulana Khomyuk comme un personnage composite inspiré de scientifiques réels.',
      'nuclear.chernobyl-later-effects': 'L’UNSCEAR a recensé 6 848 cancers de la thyroïde entre 1991 et 2005 chez les personnes qui avaient moins de 18 ans en 1986 au Bélarus, en Ukraine et dans les quatre régions russes les plus touchées, dont 15 cas mortels jusqu’en 2005 ; il relie une part importante au radioiode sans attribuer chaque cas individuellement. Ce total couvre le suivi des cancers thyroïdiens jusqu’en 2005 ; la mortalité totale de l’accident comprend d’autres causes et des périodes ultérieures. Son évaluation historique de 2008 ne trouve pas de preuve claire d’une hausse liée aux rayonnements des autres cancers solides ou des leucémies dans la population générale, tout en relevant des indications de leucémie chez les travailleurs de récupération les plus exposés.',
      'nuclear.chernobyl-projection-exposed': 'Le Forum de Tchernobyl a projeté jusqu’à environ 4 000 décès liés aux rayonnements sur la vie entière de près de 600 000 travailleurs d’urgence, personnes évacuées et habitants fortement exposés, en combinant les décès déjà connus et une projection statistique.',
      'nuclear.chernobyl-projection-europe': 'Les modèles du CIRC ont projeté environ 16 000 décès par cancer liés aux rayonnements en Europe d’ici 2065, avec un intervalle d’incertitude à 95 % de 6 700 à 38 000 ; il s’agit de décès supplémentaires modélisés et non d’attributions individuelles observées.',
      'nuclear.fukushima-acute': 'L’OMS ne rapporte aucune lésion aiguë ni aucun décès aigu dû à l’exposition aux rayonnements causée par l’accident nucléaire de Fukushima, parmi les travailleurs ou le public. Ce périmètre radiologique aigu ne couvre pas les dommages liés à l’évacuation ou au déplacement et n’établit pas un risque individuel nul à long terme.',
      'nuclear.fukushima-evacuation': 'L’UNSCEAR rapporte chez les personnes évacuées de Fukushima des changements sanitaires probablement associés aux conditions sociales et au mode de vie plutôt qu’à l’exposition aux rayonnements.',
      'nuclear.unscear-followup-finding': 'L’UNSCEAR ne rapporte aucun effet sanitaire documenté chez les habitants de Fukushima directement attribuable à l’exposition aux rayonnements et prévoit qu’une éventuelle augmentation future sera probablement indiscernable. Ce constat ne signifie ni absence de dommages liés à l’accident ni risque individuel nul.',
      'nuclear.banqiao-deaths': 'Le PSI rapporte environ 26 000 personnes tuées par les vagues de crue immédiates lors des ruptures des barrages de Banqiao et Shimantan en 1975.',
    },
    contributions: {
      'nuclear.owid-rates': 'Our World in Data : taux de mortalité de la production d’énergie par TWh',
      'nuclear.lancet-2007': 'The Lancet : production d’électricité et santé',
      'nuclear.nea-full-costs': 'Agence pour l’énergie nucléaire de l’OCDE : le coût complet de la production d’électricité',
      'nuclear.psi-german-sustainability': 'Institut Paul Scherrer : forces et faiblesses des chaînes énergétiques actuelles dans une perspective de développement durable',
      'nuclear.nasa-kharecha-summary': 'NASA GISS : le charbon et le gaz sont bien plus nocifs que l’énergie nucléaire',
      'nuclear.kharecha-hansen-2013': 'Kharecha et Hansen : mortalité et émissions de gaz à effet de serre évitées par l’énergie nucléaire historique et projetée',
      'nuclear.press-energy-mortality-comparison': 'Le Monde : présidentielle 2022, le nucléaire est-il dangereux ?',
      'nuclear.press-coal-mortality': 'Santé Magazine : la pollution des centrales à charbon serait plus meurtrière que prévu',
      'nuclear.henneman-science-2023': 'Science : risque de mortalité lié à la production électrique au charbon aux États-Unis',
      'nuclear.uranium-mining-review': 'Environmental Health : mines d’uranium et cancer du poumon, un héritage de l’ère nucléaire',
      'nuclear.puma-2024': 'PUMA : risque de cancer pulmonaire sur la vie entière dû au radon',
      'nuclear.cnsc-inworks': 'Commission canadienne de sûreté nucléaire : étude INWORKS sur la mortalité par cancer',
      'nuclear.inworks-2023': 'The BMJ : mortalité par cancer après de faibles doses chez les travailleurs du nucléaire',
      'nuclear.hbo-chernobyl': 'HBO : Chernobyl',
      'nuclear.hbo-chernobyl-podcast': 'HBO et Sky : le podcast Chernobyl',
      'nuclear.unscear-chernobyl': 'UNSCEAR 2008, annexe D (publiée en 2011) : effets sanitaires dus aux rayonnements de l’accident de Tchernobyl',
      'nuclear.who-chernobyl-forum': 'OMS : Tchernobyl, l’ampleur réelle de l’accident',
      'nuclear.iarc-chernobyl': 'CIRC : estimation du fardeau des cancers en Europe après Tchernobyl',
      'nuclear.iaea-fukushima-accident': 'AIEA : l’accident de Fukushima Daiichi',
      'nuclear.who-fukushima': 'OMS : conséquences sanitaires de l’accident nucléaire de Fukushima',
      'nuclear.unscear-fukushima': 'Rapport UNSCEAR 2020/2021 sur Fukushima : questions et réponses',
      'nuclear.press-fukushima-context': 'Le Monde : dix ans après, l’impossible bilan de la catastrophe nucléaire de Fukushima',
      'nuclear.psi-banqiao': 'Institut Paul Scherrer : évaluation comparative des accidents graves dans le secteur énergétique chinois',
      'nuclear.nea-comparing-risks': 'Agence pour l’énergie nucléaire de l’OCDE : comparaison des risques d’accident nucléaire avec ceux d’autres sources d’énergie',
    },
    locators: {
      'nuclear.owid-rates': 'Estimations 2021 · le tableau combine les décès dus aux accidents et à la pollution de l’air',
      'nuclear.lancet-2007': 'Publié en 2007 · tableau 2, estimation des décès par TWh en Europe',
      'nuclear.nea-full-costs': 'Publié en 2018 · tableau 5.2, p. 116 imprimée (p. 118 du PDF) · reproduction des estimations du Lancet de 2007',
      'nuclear.psi-german-sustainability': 'Publié en juillet 2006 · tableau 4, p. 453 imprimée (p. 7 du PDF) · années de vie perdues par GWh en fonctionnement normal des chaînes énergétiques allemandes en 2000',
      'nuclear.nasa-kharecha-summary': 'Publié en avril 2013 · résumé par les auteurs de la mortalité évitée grâce à la production nucléaire historique, 1971–2009',
      'nuclear.kharecha-hansen-2013': 'Publié en 2013 · pp. 4889–4891, tableau 1 et scénario historique de remplacement · DOI 10.1021/es3051197',
      'nuclear.press-energy-mortality-comparison': '27 mars 2022 · rapporte la comparaison d’Our World in Data entre le nucléaire, le charbon et le gaz',
      'nuclear.press-coal-mortality': '24 novembre 2023 · présente l’étude de Science sur la mortalité liée aux centrales à charbon américaines',
      'nuclear.henneman-science-2023': 'Publié le 23 novembre 2023 · DOI 10.1126/science.adf4915',
      'nuclear.uranium-mining-review': 'Synthèse de 2025 · exposition au radon des mineurs d’uranium et cancer du poumon',
      'nuclear.puma-2024': 'Étude de 2024 · PMID 38172372 · DOI 10.1007/s00411-023-01049-w',
      'nuclear.cnsc-inworks': 'Page d’information de 2024 · interprétation de la mise à jour INWORKS de 2023',
      'nuclear.inworks-2023': 'Étude de cohorte de 2023 · 309 932 travailleurs · DOI 10.1136/bmj-2022-074520',
      'nuclear.hbo-chernobyl': 'Minisérie de 2019 · représentation dramatisée de l’accident de 1986',
      'nuclear.hbo-chernobyl-podcast': 'Podcast officiel de 2019 · les épisodes 1 et 2 expliquent des écarts aux événements et le personnage composite Ulana Khomyuk',
      'nuclear.unscear-chernobyl': '§§ 2, 66 et 99 · cas thyroïdiens : pp. 64–65 imprimées (pp. 24–25 du PDF) ; décès aigus : § 2 et § 99',
      'nuclear.who-chernobyl-forum': '5 septembre 2005 · projection du Forum de Tchernobyl pour les populations les plus exposées',
      'nuclear.iarc-chernobyl': 'Note de 2006 · projections européennes jusqu’en 2065 et intervalles d’incertitude à 95 %',
      'nuclear.iaea-fukushima-accident': 'Rapport du Directeur général de 2015 · causes, conséquences, évacuation et enseignements',
      'nuclear.who-fukushima': 'Mis à jour le 10 mars 2016 · lésions aiguës et décès dus aux rayonnements',
      'nuclear.unscear-fukushima': 'Questions 3 et 4 · effets des rayonnements sur les habitants et troubles observés chez les personnes évacuées',
      'nuclear.press-fukushima-context': '11 mars 2021 · présente l’évaluation UNSCEAR, l’évacuation et les déplacements durables',
      'nuclear.psi-banqiao': 'Rapport de mars 2003 · pp. 73–74 (PDF pp. 89–90), § 4.6.3, tableau 16 · environ 26 000 décès immédiats dus aux vagues de crue',
      'nuclear.nea-comparing-risks': 'Rapport de 2010 · pp. 34–36 (PDF pp. 30–32), § 5.1 · contexte de Banqiao et variation OCDE/hors OCDE',
    },
    urls: {
      'nuclear.press-energy-mortality-comparison': 'https://www.lemonde.fr/planete/video/2022/03/27/presidentielle-2022-le-nucleaire-est-il-dangereux_6119357_3244.html',
      'nuclear.press-coal-mortality': 'https://www.santemagazine.fr/actualites/actualites-sante/selon-une-etude-la-pollution-des-centrales-a-charbon-serait-plus-meurtriere-que-prevu-1041239',
      'nuclear.press-fukushima-context': 'https://www.lemonde.fr/planete/article/2021/03/11/dix-ans-apres-l-impossible-bilan-de-la-catastrophe-nucleaire-de-fukushima_6072670_3244.html',
    },
  },
};

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function cloneInquiry(inquiry) {
  return {
    rootClaimId: inquiry.rootClaimId,
    claims: inquiry.claims.map(({ id, title, description, prior }) => ({
      id, title, description, prior: { ...prior },
    })),
    contributions: inquiry.contributions.map((contribution) => ({ ...contribution })),
    evidence: inquiry.evidence.map(({ impact, relayContributionIds, ...item }) => ({
      ...item,
      ...(relayContributionIds ? { relayContributionIds: [...relayContributionIds] } : {}),
      impact: { ...impact },
    })),
  };
}

export const INQUIRY_PRESETS = deepFreeze([nuclear]);

export function createInquiryPreset(id, locale = 'en') {
  const preset = INQUIRY_PRESETS.find((candidate) => candidate.id === id);
  if (!preset) throw new Error(`Unknown inquiry preset: ${id}`);
  const inquiry = cloneInquiry(preset.inquiry);
  const translation = locale === 'fr' ? french[id] : undefined;
  if (!translation) return inquiry;
  for (const item of inquiry.claims) {
    item.title = translation.titles[item.id] ?? item.title;
    item.description = translation.descriptions[item.id] ?? item.description;
  }
  for (const item of inquiry.contributions) {
    item.title = translation.contributions[item.id] ?? item.title;
    item.url = translation.urls?.[item.id] ?? item.url;
    if (item.locator) item.locator = translation.locators[item.id] ?? item.locator;
  }
  return inquiry;
}
