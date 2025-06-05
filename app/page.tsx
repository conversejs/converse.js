export default function Home() {
    return (
        <section className="section-wrapper">
            <nav className="navbar sticky-top navbar-expand-lg" role="navigation">
                <button
                    className="navbar-toggler"
                    type="button"
                    data-toggle="collapse"
                    data-target="#navbarTogglerDemo01"
                    aria-controls="navbarTogglerDemo01"
                    aria-expanded="false"
                    aria-label="Toggle navigation"
                >
                    <span className="navbar-toggler-icon"></span>
                </button>
                <div className="collapse navbar-collapse" id="navbarTogglerDemo01">
                    <span className="page-scroll">
                        <a className="navbar-brand" href="#intro">
                            <span className="converse-brand-heading">Home</span>
                        </a>
                    </span>
                    <ul className="navbar-nav mt-2 mt-lg-0">
                        {/* Hidden li included to remove active className from about link when scrolled up past about section */}
                        <li className="hidden">
                            <a className="nav-link" href="#page-top"></a>
                        </li>
                        <li className="nav-item page-scroll">
                            <a className="nav-link" href="#about">
                                About
                            </a>
                        </li>
                        <li className="nav-item page-scroll">
                            <a className="nav-link" href="#contact">
                                Contact
                            </a>
                        </li>
                        <li className="nav-item">
                            <a
                                className="nav-link"
                                href="https://github.com/conversejs/converse.js"
                                target="_blank"
                                rel="noopener"
                            >
                                Github&nbsp;<i className="fa fa-external-link-alt"></i>
                            </a>
                        </li>
                        <li className="nav-item">
                            <a className="nav-link" href="/docs/html/index.html">
                                Documentation&nbsp;<i className="fa fa-external-link-alt"></i>
                            </a>
                        </li>
                        <li className="nav-item">
                            <a
                                className="nav-link button"
                                href="https://github.com/conversejs/converse.js/releases"
                                target="_blank"
                                rel="noopener"
                            >
                                Download&nbsp;<i className="fa fa-external-link-alt"></i>
                            </a>
                        </li>
                    </ul>
                </div>
            </nav>


        </section>
    );
}
